//! Connection handler for Mumble-WebRTC proxy
//!
//! This module manages the bidirectional proxy between a WebSocket client and a Mumble server,
//! handling ICE/WebRTC setup, DTLS-SRTP negotiation, and voice packet transcoding.

use std::collections::{BTreeMap, VecDeque};
use std::ffi::CString;
use std::future::Future;
use std::net::IpAddr;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Duration;

use futures::{future::BoxFuture, pin_mut, ready, FutureExt, Sink, Stream};
use libnice::ice;
use mumble_protocol::control::{msgs, ControlPacket};
use mumble_protocol::voice::{VoicePacket, VoicePacketPayload};
use mumble_protocol::{Clientbound, Serverbound};
use openssl::asn1::Asn1Time;
use openssl::hash::MessageDigest;
use openssl::pkey::{PKey, Private};
use openssl::rsa::Rsa;
use openssl::ssl::{SslAcceptor, SslAcceptorBuilder, SslMethod};
use openssl::x509::X509;
use rtp::rfc3550::{
    RtcpCompoundPacket, RtcpPacket, RtcpPacketReader, RtcpPacketWriter, RtpFixedHeader, RtpPacket,
    RtpPacketReader, RtpPacketWriter,
};
use rtp::rfc5761::{MuxPacketReader, MuxPacketWriter, MuxedPacket};
use rtp::rfc5764::DtlsSrtp;
use rtp::traits::{ReadPacket, WritePacket};
use tokio::io;
use tokio::time::Sleep;
use tracing::{debug, info, warn};
use webrtc_sdp::attribute_type::SdpAttribute;

use crate::error::Error;
use crate::Config;

type SessionId = u32;

/// Represents a connected user in the Mumble session
struct User {
    /// Mumble session ID
    session: u32,
    /// RTP SSRC identifier
    ssrc: u32,
    /// Whether the user is currently transmitting audio
    active: bool,
    /// Timeout for detecting end of transmission
    timeout: Option<Pin<Box<Sleep>>>,
    /// Voice sequence number tracking
    start_voice_seq_num: u64,
    highest_voice_seq_num: u64,
    /// RTP sequence number offset
    rtp_seq_num_offset: u32,
}

impl User {
    /// Mark user as inactive (stopped talking)
    fn set_inactive(&mut self) -> Option<Frame> {
        self.timeout = None;

        if self.active {
            self.active = false;

            self.rtp_seq_num_offset = self
                .rtp_seq_num_offset
                .wrapping_add((self.highest_voice_seq_num - self.start_voice_seq_num) as u32 + 1);
            self.start_voice_seq_num = 0;
            self.highest_voice_seq_num = 0;

            let mut msg = msgs::TalkingState::new();
            msg.set_session(self.session);
            Some(Frame::Client(msg.into()))
        } else {
            None
        }
    }

    /// Mark user as active (started talking)
    fn set_active(&mut self, target: u8) -> Option<Frame> {
        self.timeout = Some(Box::pin(tokio::time::sleep(Duration::from_millis(400))));

        if self.active {
            None
        } else {
            self.active = true;

            let mut msg = msgs::TalkingState::new();
            msg.set_session(self.session);
            msg.set_target(target.into());
            Some(Frame::Client(msg.into()))
        }
    }
}

/// Manages a single client connection to the proxy
pub struct Connection {
    config: Arc<Config>,
    inbound_client: Pin<Box<dyn Stream<Item = Result<ControlPacket<Serverbound>, Error>> + Send>>,
    outbound_client: Pin<Box<dyn Sink<ControlPacket<Clientbound>, Error = Error> + Send>>,
    inbound_server: Pin<Box<dyn Stream<Item = Result<ControlPacket<Clientbound>, Error>> + Send>>,
    outbound_server: Pin<Box<dyn Sink<ControlPacket<Serverbound>, Error = Error> + Send>>,
    outbound_buf: VecDeque<Frame>,

    ice: Option<(ice::Agent, ice::Stream)>,
    candidate_gathering_done: bool,

    dtls_srtp_future: Option<
        BoxFuture<'static, Result<DtlsSrtp<ice::StreamComponent, SslAcceptorBuilder>, io::Error>>,
    >,
    dtls_srtp: Option<DtlsSrtp<ice::StreamComponent, SslAcceptorBuilder>>,
    dtls_key: PKey<Private>,
    dtls_cert: X509,

    rtp_reader: MuxPacketReader<RtpPacketReader, RtcpPacketReader>,
    rtp_writer: MuxPacketWriter<RtpPacketWriter, RtcpPacketWriter>,

    target: Option<u8>,
    next_ssrc: u32,
    free_ssrcs: Vec<u32>,
    sessions: BTreeMap<SessionId, User>,
}

impl Connection {
    /// Create a new connection handler
    pub fn new<CSi, CSt, SSi, SSt>(
        config: Arc<Config>,
        client_sink: CSi,
        client_stream: CSt,
        server_sink: SSi,
        server_stream: SSt,
    ) -> Self
    where
        CSi: Sink<ControlPacket<Clientbound>, Error = Error> + 'static + Send,
        CSt: Stream<Item = Result<ControlPacket<Serverbound>, Error>> + 'static + Send,
        SSi: Sink<ControlPacket<Serverbound>, Error = Error> + 'static + Send,
        SSt: Stream<Item = Result<ControlPacket<Clientbound>, Error>> + 'static + Send,
    {
        let rsa = Rsa::generate(2048).expect("Failed to generate RSA key");
        let key = PKey::from_rsa(rsa).expect("Failed to create PKey");

        let mut cert_builder = X509::builder().expect("Failed to create X509 builder");
        cert_builder
            .set_not_after(&Asn1Time::days_from_now(1).expect("Invalid time"))
            .expect("Failed to set expiry");
        cert_builder
            .set_not_before(&Asn1Time::days_from_now(0).expect("Invalid time"))
            .expect("Failed to set start time");
        cert_builder.set_pubkey(&key).expect("Failed to set pubkey");
        cert_builder
            .sign(&key, MessageDigest::sha256())
            .expect("Failed to sign certificate");
        let cert = cert_builder.build();

        Self {
            config,
            inbound_client: Box::pin(client_stream),
            outbound_client: Box::pin(client_sink),
            inbound_server: Box::pin(server_stream),
            outbound_server: Box::pin(server_sink),
            outbound_buf: VecDeque::new(),
            ice: None,
            candidate_gathering_done: false,
            dtls_srtp_future: None,
            dtls_srtp: None,
            dtls_key: key,
            dtls_cert: cert,
            rtp_reader: MuxPacketReader::new(RtpPacketReader, RtcpPacketReader),
            rtp_writer: MuxPacketWriter::new(RtpPacketWriter, RtcpPacketWriter),
            target: None,
            next_ssrc: 1,
            free_ssrcs: Vec::new(),
            sessions: BTreeMap::new(),
        }
    }

    /// Check if WebRTC is supported for this connection
    fn supports_webrtc(&self) -> bool {
        self.ice.is_some()
    }

    /// Allocate a new SSRC for a user session
    fn allocate_ssrc(&mut self, session_id: SessionId) -> &mut User {
        let ssrc = self.free_ssrcs.pop().unwrap_or_else(|| {
            let ssrc = self.next_ssrc;
            self.next_ssrc += 1;
            if let Some(ref mut dtls_srtp) = self.dtls_srtp {
                dtls_srtp.add_incoming_unknown_ssrcs(1);
                dtls_srtp.add_outgoing_unknown_ssrcs(1);
            }
            ssrc
        });
        let user = User {
            session: session_id,
            ssrc,
            active: false,
            timeout: None,
            start_voice_seq_num: 0,
            highest_voice_seq_num: 0,
            rtp_seq_num_offset: 0,
        };
        self.sessions.insert(session_id, user);
        self.sessions.get_mut(&session_id).unwrap()
    }

    /// Free SSRC when user disconnects
    fn free_ssrc(&mut self, session_id: SessionId) {
        if let Some(user) = self.sessions.remove(&session_id) {
            self.free_ssrcs.push(user.ssrc)
        }
    }

    /// Initialize ICE agent and send WebRTC details to client
    fn setup_ice(&mut self) -> Result<(), Error> {
        info!("Setting up ICE agent");

        // Setup ICE agent
        let mut agent = ice::Agent::new_rfc5245();
        agent.set_software("mumble-web-proxy");
        agent.set_controlling_mode(true);

        // Setup ICE stream
        let mut stream = {
            let mut builder = agent.stream_builder(1);
            if self.config.ice_port_min != 1 || self.config.ice_port_max != u16::MAX {
                builder.set_port_range(self.config.ice_port_min, self.config.ice_port_max);
            }
            builder.build().map_err(|e| Error::Ice(e.to_string()))?
        };
        let component = stream.take_components().pop().expect("one component");

        // Calculate DTLS fingerprint
        let fingerprint = self
            .dtls_cert
            .digest(MessageDigest::sha256())
            .map_err(|e| Error::Protocol(format!("Failed to calculate fingerprint: {}", e)))?
            .iter()
            .map(|byte| format!("{:02X}", byte))
            .collect::<Vec<_>>()
            .join(":");

        // Send WebRTC details to the client
        let mut msg = msgs::WebRTC::new();
        msg.set_dtls_fingerprint(fingerprint);
        msg.set_ice_pwd(stream.get_local_pwd().to_owned());
        msg.set_ice_ufrag(stream.get_local_ufrag().to_owned());

        // Store ice agent and stream for later use
        self.ice = Some((agent, stream));

        // Prepare to accept the DTLS connection
        let mut acceptor = SslAcceptor::mozilla_intermediate(SslMethod::dtls())
            .map_err(|e| Error::Protocol(format!("Failed to create DTLS acceptor: {}", e)))?;
        acceptor
            .set_certificate(&self.dtls_cert)
            .map_err(|e| Error::Protocol(format!("Failed to set certificate: {}", e)))?;
        acceptor
            .set_private_key(&self.dtls_key)
            .map_err(|e| Error::Protocol(format!("Failed to set private key: {}", e)))?;
        self.dtls_srtp_future = Some(DtlsSrtp::handshake(component, acceptor).boxed());

        self.outbound_buf.push_back(Frame::Client(msg.into()));
        Ok(())
    }

    /// Gather ICE candidates and send them to the client
    fn gather_ice_candidates(mut self: Pin<&mut Self>, cx: &mut Context) -> bool {
        if self.candidate_gathering_done {
            return false;
        }
        let stream = match self.ice {
            Some((_, ref mut stream)) => stream,
            None => return false,
        };
        pin_mut!(stream);
        match stream.poll_next(cx) {
            Poll::Ready(Some(mut candidate)) => {
                debug!(candidate = %candidate, "Local ICE candidate");

                // Map to public addresses (if configured)
                let config = &self.config;
                match (
                    &mut candidate.address,
                    config.ice_ipv4,
                    config.ice_ipv6,
                ) {
                    (webrtc_sdp::address::Address::Ip(IpAddr::V4(addr)), Some(public), _) => {
                        *addr = public;
                    }
                    (webrtc_sdp::address::Address::Ip(IpAddr::V6(addr)), _, Some(public)) => {
                        *addr = public;
                    }
                    _ => {}
                };

                // Got a new candidate, send it to the client
                let mut msg = msgs::IceCandidate::new();
                msg.set_content(format!("candidate:{}", candidate.to_string()));
                let frame = Frame::Client(msg.into());
                self.outbound_buf.push_back(frame);
                true
            }
            Poll::Ready(None) => {
                self.candidate_gathering_done = true;
                info!("ICE candidate gathering complete");
                false
            }
            _ => false,
        }
    }

    /// Dispatch queued outbound frames
    fn dispatch_outbound_frames(
        mut self: Pin<&mut Self>,
        cx: &mut Context,
    ) -> Poll<Result<(), Error>> {
        ready!(self.outbound_server.as_mut().poll_ready(cx)?);
        ready!(self.outbound_client.as_mut().poll_ready(cx)?);
        if let Some(ref mut dtls_srtp) = self.dtls_srtp {
            ready!(Pin::new(dtls_srtp).poll_ready(cx)?);
        }

        while let Some(frame) = self.outbound_buf.pop_front() {
            match frame {
                Frame::Server(frame) => {
                    self.outbound_server.as_mut().start_send(frame)?;
                    ready!(self.outbound_server.as_mut().poll_ready(cx)?);
                }
                Frame::Client(frame) => {
                    self.outbound_client.as_mut().start_send(frame)?;
                    ready!(self.outbound_client.as_mut().poll_ready(cx)?);
                }
                Frame::Rtp(frame) => {
                    let mut buf = Vec::new();
                    self.rtp_writer.write_packet(&mut buf, &frame)?;
                    if let Some(ref mut dtls_srtp) = self.dtls_srtp {
                        pin_mut!(dtls_srtp);
                        dtls_srtp.as_mut().start_send(&buf)?;
                        ready!(dtls_srtp.poll_ready(cx)?);
                    }
                }
            }
        }

        let _ = self.outbound_client.as_mut().poll_flush(cx)?;
        let _ = self.outbound_server.as_mut().poll_flush(cx)?;
        if let Some(ref mut dtls_srtp) = self.dtls_srtp {
            let _ = Pin::new(dtls_srtp).poll_flush(cx)?;
        }

        Poll::Ready(Ok(()))
    }

    /// Handle incoming voice packet from Mumble server
    fn handle_voice_packet(&mut self, packet: VoicePacket<Clientbound>) -> Result<(), Error> {
        let (target, session_id, seq_num, opus_data, last_bit) = match packet {
            VoicePacket::Audio {
                target,
                session_id,
                seq_num,
                payload: VoicePacketPayload::Opus(data, last_bit),
                ..
            } => (target, session_id, seq_num, data, last_bit),
            _ => return Ok(()),
        };

        let user = match self.sessions.get_mut(&(session_id as u32)) {
            Some(s) => s,
            None => return Ok(()),
        };
        let rtp_ssrc = user.ssrc;

        let mut first_in_transmission = if user.active {
            false
        } else {
            user.start_voice_seq_num = seq_num;
            user.highest_voice_seq_num = seq_num;
            true
        };

        let offset = seq_num - user.start_voice_seq_num;
        let mut rtp_seq_num = user.rtp_seq_num_offset + offset as u32;

        if last_bit {
            if seq_num <= user.highest_voice_seq_num {
                return Ok(());
            }
            if let Some(frame) = user.set_inactive() {
                self.outbound_buf.push_back(frame);
            }
        } else if seq_num == user.highest_voice_seq_num && seq_num != user.start_voice_seq_num {
            return Ok(());
        } else if seq_num >= user.highest_voice_seq_num
            && seq_num < user.highest_voice_seq_num + 100
        {
            user.highest_voice_seq_num = seq_num;
            if let Some(frame) = user.set_active(target) {
                self.outbound_buf.push_back(frame);
            }
        } else if seq_num < user.highest_voice_seq_num && seq_num + 100 > user.highest_voice_seq_num
        {
            if let Some(frame) = user.set_active(target) {
                self.outbound_buf.push_back(frame);
            }
        } else {
            if let Some(frame) = user.set_inactive() {
                self.outbound_buf.push_back(frame);
            }
            first_in_transmission = true;
            user.start_voice_seq_num = seq_num;
            user.highest_voice_seq_num = seq_num;
            rtp_seq_num = user.rtp_seq_num_offset;
            if let Some(frame) = user.set_active(target) {
                self.outbound_buf.push_back(frame);
            }
        };

        let rtp_time = 480 * rtp_seq_num;

        let rtp = RtpPacket {
            header: RtpFixedHeader {
                padding: false,
                marker: first_in_transmission,
                payload_type: 97,
                seq_num: rtp_seq_num as u16,
                timestamp: rtp_time as u32,
                ssrc: rtp_ssrc,
                csrc_list: Vec::new(),
                extension: None,
            },
            payload: opus_data.to_vec(),
            padding: Vec::new(),
        };
        let frame = Frame::Rtp(MuxedPacket::Rtp(rtp));
        self.outbound_buf.push_back(frame);

        Ok(())
    }

    /// Process packet received from Mumble server
    fn process_packet_from_server(
        &mut self,
        packet: ControlPacket<Clientbound>,
    ) -> Result<(), Error> {
        if !self.supports_webrtc() {
            self.outbound_buf.push_back(Frame::Client(packet));
            return Ok(());
        }
        match packet {
            ControlPacket::UDPTunnel(voice) => return self.handle_voice_packet(*voice),
            ControlPacket::UserState(mut message) => {
                let session_id = message.get_session();
                if !self.sessions.contains_key(&session_id) {
                    let user = self.allocate_ssrc(session_id);
                    message.set_ssrc(user.ssrc);
                }
                self.outbound_buf
                    .push_back(Frame::Client((*message).into()));
            }
            ControlPacket::UserRemove(message) => {
                self.free_ssrc(message.get_session());
                self.outbound_buf
                    .push_back(Frame::Client((*message).into()));
            }
            other => self.outbound_buf.push_back(Frame::Client(other)),
        };
        Ok(())
    }

    /// Process packet received from WebSocket client
    fn process_packet_from_client(
        &mut self,
        packet: ControlPacket<Serverbound>,
    ) -> Result<(), Error> {
        match packet {
            ControlPacket::Authenticate(mut message) => {
                debug!(
                    webrtc = message.get_webrtc(),
                    "Received Authenticate message"
                );
                if message.get_webrtc() {
                    message.clear_webrtc();
                    message.set_opus(true);
                    self.outbound_buf
                        .push_back(Frame::Server((*message).into()));

                    self.setup_ice()?;
                } else {
                    self.outbound_buf
                        .push_back(Frame::Server((*message).into()));
                }
            }
            ControlPacket::WebRTC(mut message) => {
                debug!("Received WebRTC message");
                if let Some((_, stream)) = &mut self.ice {
                    if let (Ok(ufrag), Ok(pwd)) = (
                        CString::new(message.take_ice_ufrag()),
                        CString::new(message.take_ice_pwd()),
                    ) {
                        stream.set_remote_credentials(ufrag, pwd);
                    }
                }
            }
            ControlPacket::IceCandidate(mut message) => {
                let candidate = message.take_content();
                debug!(candidate = %candidate, "Received ICE candidate");
                if let Some((_, stream)) = &mut self.ice {
                    match format!("candidate:{}", candidate).parse() {
                        Ok(SdpAttribute::Candidate(candidate)) => {
                            stream.add_remote_candidate(candidate)
                        }
                        Ok(_) => unreachable!(),
                        Err(err) => {
                            return Err(Error::Ice(format!("Error parsing ICE candidate: {}", err)));
                        }
                    }
                }
            }
            ControlPacket::TalkingState(message) => {
                self.target = if message.has_target() {
                    Some(message.get_target() as u8)
                } else {
                    None
                };
            }
            other => {
                self.outbound_buf.push_back(Frame::Server(other));
            }
        };
        Ok(())
    }

    /// Process incoming RTP packet from WebRTC client
    fn process_rtp_packet(&mut self, buf: &[u8]) {
        match self.rtp_reader.read_packet(&mut &buf[..]) {
            Ok(MuxedPacket::Rtp(rtp)) => {
                if let Some(target) = self.target {
                    let seq_num = rtp.header.timestamp / 480;

                    let voice_packet = VoicePacket::Audio {
                        _dst: std::marker::PhantomData::<Serverbound>,
                        target,
                        session_id: (),
                        seq_num: seq_num.into(),
                        payload: VoicePacketPayload::Opus(rtp.payload.into(), false),
                        position_info: None,
                    };

                    self.outbound_buf
                        .push_back(Frame::Server(voice_packet.into()));
                }
            }
            Ok(MuxedPacket::Rtcp(_rtcp)) => {}
            Err(err) => {
                warn!(error = %err, "Failed to parse RTP packet");
            }
        }
    }
}

impl Future for Connection {
    type Output = Result<(), Error>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context) -> Poll<Result<(), Error>> {
        'poll: loop {
            if let Some((ref mut agent, _)) = self.ice {
                pin_mut!(agent);
                let _ = agent.poll(cx);
            }

            ready!(self.as_mut().dispatch_outbound_frames(cx))?;

            for session in self.sessions.values_mut() {
                if let Some(timeout) = &mut session.timeout {
                    if let Poll::Ready(()) = timeout.poll_unpin(cx) {
                        if let Some(frame) = session.set_inactive() {
                            self.outbound_buf.push_back(frame);
                        }
                        continue 'poll;
                    }
                }
            }

            if self.as_mut().gather_ice_candidates(cx) {
                continue 'poll;
            }

            if let Some(ref mut future) = self.dtls_srtp_future {
                pin_mut!(future);
                if let Poll::Ready(mut dtls_srtp) = future.poll(cx)? {
                    self.dtls_srtp_future = None;

                    info!("DTLS-SRTP connection established");

                    dtls_srtp.add_incoming_unknown_ssrcs(self.next_ssrc as usize);
                    dtls_srtp.add_outgoing_unknown_ssrcs(self.next_ssrc as usize);

                    self.dtls_srtp = Some(dtls_srtp);
                }
            }

            match self.inbound_server.as_mut().poll_next(cx)? {
                Poll::Pending => {}
                Poll::Ready(Some(frame)) => {
                    self.process_packet_from_server(frame)?;
                    continue 'poll;
                }
                Poll::Ready(None) => return Poll::Ready(Ok(())),
            }
            match self.inbound_client.as_mut().poll_next(cx)? {
                Poll::Pending => {}
                Poll::Ready(Some(frame)) => {
                    self.process_packet_from_client(frame)?;
                    continue 'poll;
                }
                Poll::Ready(None) => return Poll::Ready(Ok(())),
            }
            if let Some(ref mut dtls_srtp) = self.dtls_srtp {
                pin_mut!(dtls_srtp);
                match dtls_srtp.poll_next(cx)? {
                    Poll::Pending => {}
                    Poll::Ready(Some(frame)) => {
                        self.process_rtp_packet(&frame);
                        continue 'poll;
                    }
                    Poll::Ready(None) => return Poll::Ready(Ok(())),
                }
            }

            return Poll::Pending;
        }
    }
}

/// Represents a frame to be sent
#[derive(Clone)]
enum Frame {
    Server(ControlPacket<Serverbound>),
    Client(ControlPacket<Clientbound>),
    Rtp(MuxedPacket<RtpPacket, RtcpCompoundPacket<RtcpPacket>>),
}
