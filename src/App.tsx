import { useState } from 'react'
import CodeViewer from './components/CodeViewer'
import ChangesOverview from './components/ChangesOverview'
import FileExplorer from './components/FileExplorer'
import GitGuide from './components/GitGuide'

const files = {
  'Cargo.toml': {
    old: `[package]
name = "mumble-web-proxy"
version = "0.1.1"
authors = ["Jonas Herzig <me@johni0702.de>"]
edition = "2018"

[dependencies]
argparse = "0.2.2"
bytes = "1"
byteorder = "1.2"
futures = { version = "0.3", features = ["compat", "io-compat"] }
toml = "0.5"
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
tokio-util = { version = "0.6", features = ["codec"] }
tokio-native-tls = "0.3"
native-tls = "0.2"
mumble-protocol = { version = "0.4", features = ["webrtc-extensions"] }
tokio-tungstenite = "0.13"
http = "0.2"
tungstenite = "0.12"
rtp = { git = "https://github.com/johni0702/rtp", rev = "6c0223d", features = ["rfc5764-openssl"] }
libnice = "0.3"
webrtc-sdp = "0.3"
openssl = "0.10"`,
    new: `[package]
name = "mumble-web-proxy"
version = "0.2.0"
authors = ["Jonas Herzig <me@johni0702.de>"]
edition = "2021"
rust-version = "1.70"

[dependencies]
# CLI parsing
clap = { version = "4.4", features = ["derive"] }

# Async runtime
tokio = { version = "1.35", features = ["full"] }
tokio-util = { version = "0.7", features = ["codec"] }
futures = "0.3"

# Serialization
serde = { version = "1.0", features = ["derive"] }
toml = "0.8"

# Networking & protocols
bytes = "1.5"
byteorder = "1.5"
mumble-protocol = { version = "0.5", features = ["webrtc-extensions"] }
tokio-tungstenite = "0.21"
tungstenite = "0.21"
http = "1.0"

# TLS
tokio-rustls = "0.25"
rustls = "0.22"
rustls-pemfile = "2.0"

# WebRTC & ICE
libnice = "0.4"
webrtc-sdp = "0.4"
rtp = { git = "https://github.com/webrtc-rs/rtp", tag = "v0.12.0" }

# Cryptography
openssl = "0.10"

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[profile.release]
lto = true
codegen-units = 1
strip = true`
  },
  'src/main.rs': {
    old: `use argparse::StoreOption;
use argparse::StoreTrue;
use argparse::{ArgumentParser, Store};
use byteorder::{BigEndian, ByteOrder};
use bytes::{BufMut, Bytes, BytesMut};
use futures::{future, SinkExt, StreamExt, TryFutureExt, TryStreamExt};
use http::HeaderValue;
use mumble_protocol::control::ClientControlCodec;
use mumble_protocol::control::ControlPacket;
use mumble_protocol::control::RawControlPacket;
use mumble_protocol::Clientbound;
use serde::Deserialize;
use std::convert::Into;
use std::convert::TryInto;
use std::io::ErrorKind;
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use tokio::net::TcpListener;
use tokio::net::TcpStream;
use tokio_native_tls::TlsConnector;
use tokio_tungstenite::accept_hdr_async_with_config;
use tokio_util::codec::Decoder;
use tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tungstenite::protocol::Message;
use tungstenite::protocol::WebSocketConfig;

mod connection;
mod error;
use connection::Connection;
use error::Error;

#[derive(Debug, Clone, Deserialize)]
#[serde(default, rename_all = "kebab-case")]
pub struct Config {
    pub file: Option<String>,
    #[serde(rename = "listen-ws")]
    pub ws_port: u16,
    #[serde(rename = "server")]
    pub upstream: String,
    #[serde(rename = "accept-invalid-certificate")]
    pub accept_invalid_certs: bool,
    pub ice_min_port: u16,
    pub ice_max_port: u16,
    pub ice_public_v4: Option<Ipv4Addr>,
    pub ice_public_v6: Option<Ipv6Addr>,
}

impl Default for Config {
    fn default() -> Config {
        Config {
            file: None,
            ws_port: 0_u16,
            upstream: "".to_string(),
            accept_invalid_certs: false,
            ice_min_port: 1,
            ice_max_port: u16::max_value(),
            ice_public_v4: None,
            ice_public_v6: None,
        }
    }
}

fn create_argparser(config: &mut Config) -> ArgumentParser {
    let mut ap = ArgumentParser::new();
    ap.set_description("Run the Mumble-WebRTC proxy");
    ap.refer(&mut config.file).add_option(
        &["--config"],
        StoreOption,
        "Toml file to read options from",
    );
    ap.refer(&mut config.ws_port).add_option(
        &["--listen-ws"],
        Store,
        "Port to listen for WebSocket (non TLS) connections on",
    );
    ap.refer(&mut config.upstream).add_option(
        &["--server"],
        Store,
        "Hostname and (optionally) port of the upstream Mumble server",
    );
    // ... остальной код
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut config = Config::default();
    create_argparser(&mut config).parse_args_or_exit();
    // ... остальной код
    println!("Waiting for client connections..");
    loop {
        let (client, _) = server.accept().await?;
        println!("New connection from {}", addr);
        // ... обработка соединений
    }
}`,
    new: `//! Mumble to WebSocket+WebRTC proxy
//!
//! This proxy bridges Mumble's TCP control and UDP voice protocols
//! to WebSocket and WebRTC, allowing browser-based clients to
//! connect to vanilla Mumble servers.

use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use byteorder::{BigEndian, ByteOrder};
use bytes::{BufMut, Bytes, BytesMut};
use clap::Parser;
use futures::{future, SinkExt, StreamExt, TryFutureExt, TryStreamExt};
use http::HeaderValue;
use mumble_protocol::control::{ClientControlCodec, ControlPacket, RawControlPacket};
use mumble_protocol::Clientbound;
use serde::Deserialize;
use tokio::net::{TcpListener, TcpStream};
use tokio_rustls::TlsConnector;
use tokio_tungstenite::accept_hdr_async_with_config;
use tokio_util::codec::Decoder;
use tracing::{error, info, warn};
use tungstenite::handshake::server::{Request, Response};
use tungstenite::protocol::{Message, WebSocketConfig};

mod connection;
mod error;

use connection::Connection;
use error::Error;

/// Mumble to WebSocket+WebRTC proxy
#[derive(Parser, Debug, Clone)]
#[command(name = "mumble-web-proxy", version, about, long_about = None)]
pub struct CliArgs {
    /// TOML configuration file
    #[arg(short, long)]
    pub config: Option<PathBuf>,

    /// Port to listen for WebSocket connections (non-TLS)
    #[arg(long, required = true)]
    pub listen_ws: u16,

    /// Hostname and port of the upstream Mumble server
    #[arg(long, required = true)]
    pub server: String,

    /// Accept invalid TLS certificates (DANGEROUS)
    #[arg(long, default_value = "false")]
    pub accept_invalid_certificate: bool,

    /// Minimum port for ICE host candidates
    #[arg(long, default_value = "1")]
    pub ice_port_min: u16,

    /// Maximum port for ICE host candidates
    #[arg(long, default_value = "65535")]
    pub ice_port_max: u16,

    /// Public IPv4 address for ICE (for NAT traversal)
    #[arg(long)]
    pub ice_ipv4: Option<Ipv4Addr>,

    /// Public IPv6 address for ICE (for NAT traversal)
    #[arg(long)]
    pub ice_ipv6: Option<Ipv6Addr>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default, rename_all = "kebab-case")]
pub struct Config {
    pub listen_ws: u16,
    pub server: String,
    pub accept_invalid_certificate: bool,
    pub ice_port_min: u16,
    pub ice_port_max: u16,
    pub ice_ipv4: Option<Ipv4Addr>,
    pub ice_ipv6: Option<Ipv6Addr>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            listen_ws: 0,
            server: String::new(),
            accept_invalid_certificate: false,
            ice_port_min: 1,
            ice_port_max: u16::MAX,
            ice_ipv4: None,
            ice_ipv6: None,
        }
    }
}

impl Config {
    /// Merge CLI arguments into config (CLI takes precedence)
    fn merge_with_cli(&mut self, args: &CliArgs) {
        if args.listen_ws != 0 {
            self.listen_ws = args.listen_ws;
        }
        if !args.server.is_empty() {
            self.server.clone_from(&args.server);
        }
        self.accept_invalid_certificate = args.accept_invalid_certificate;
        self.ice_port_min = args.ice_port_min;
        self.ice_port_max = args.ice_port_max;
        self.ice_ipv4 = args.ice_ipv4;
        self.ice_ipv6 = args.ice_ipv6;
    }
}

fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();
}

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();

    // Parse CLI arguments
    let args = CliArgs::parse();

    // Load config from file if specified
    let mut config = if let Some(config_path) = &args.config {
        let content = std::fs::read_to_string(config_path)
            .with_context(|| format!("Failed to read config: {:?}", config_path))?;
        toml::from_str(&content).context("Failed to parse config file")?
    } else {
        Config::default()
    };

    // Merge CLI args (CLI takes precedence)
    config.merge_with_cli(&args);

    // Validate required fields
    if config.listen_ws == 0 {
        anyhow::bail!("--listen-ws is required");
    }
    if config.server.is_empty() {
        anyhow::bail!("--server is required");
    }

    let config = Arc::new(config);

    // Parse and resolve upstream address
    let (upstream_host, upstream_port) = parse_upstream_address(&config.server)?;
    info!(host = %upstream_host, port = upstream_port, "Resolving upstream");

    let upstream_addr = (upstream_host.as_str(), upstream_port)
        .to_socket_addrs()
        .context("Failed to parse upstream address")?
        .next()
        .context("Failed to resolve upstream address")?;
    info!(addr = %upstream_addr, "Resolved upstream");

    // Bind WebSocket listener
    let socket_addrs = [
        SocketAddr::from((Ipv6Addr::UNSPECIFIED, config.listen_ws)),
        SocketAddr::from((Ipv4Addr::UNSPECIFIED, config.listen_ws)),
    ];

    let listener = TcpListener::bind(&socket_addrs[..])
        .await
        .with_context(|| format!("Failed to bind to port {}", config.listen_ws))?;

    info!(port = config.listen_ws, "WebSocket listener started");
    info!("Waiting for client connections...");

    // Accept loop
    loop {
        let (client_stream, addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(err) => {
                error!(error = %err, "Failed to accept connection");
                continue;
            }
        };

        info!(client = %addr, "New client connection");

        let config = Arc::clone(&config);
        let upstream_host = upstream_host.clone();

        tokio::spawn(async move {
            if let Err(err) = handle_client(
                client_stream, addr, config, upstream_host, upstream_addr
            ).await {
                if !err.is_connection_closed() {
                    error!(client = %addr, error = %err, "Connection error");
                } else {
                    info!(client = %addr, "Client disconnected");
                }
            }
        });
    }
}`
  },
  'src/error.rs': {
    old: `use futures::channel::mpsc;

// FIXME clean this up

#[derive(Debug)]
pub enum Error {
    Io(std::io::Error),
    ServerTls(native_tls::Error),
    ClientConnection(tungstenite::Error),
    Misc(Box<dyn std::error::Error + Send>),
}

impl Error {
    pub fn is_connection_closed(&self) -> bool {
        match self {
            Error::ClientConnection(tungstenite::Error::ConnectionClosed) => true,
            _ => false,
        }
    }
}

impl From<tungstenite::Error> for Error {
    fn from(e: tungstenite::Error) -> Self {
        Error::ClientConnection(e)
    }
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::Io(e)
    }
}

impl From<native_tls::Error> for Error {
    fn from(e: native_tls::Error) -> Self {
        Error::ServerTls(e)
    }
}

impl From<rtp::Error> for Error {
    fn from(e: rtp::Error) -> Self {
        Error::Misc(Box::new(e))
    }
}

impl From<toml::de::Error> for Error {
    fn from(e: toml::de::Error) -> Self {
        Error::Misc(Box::new(e))
    }
}

impl From<()> for Error {
    fn from(_: ()) -> Self {
        panic!();
    }
}

impl From<mpsc::SendError> for Error {
    fn from(_: mpsc::SendError) -> Self {
        panic!();
    }
}`,
    new: `//! Error types for mumble-web-proxy

use thiserror::Error;

/// Main error type for the proxy
#[derive(Error, Debug)]
pub enum Error {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("TLS error: {0}")]
    Tls(#[from] rustls::Error),

    #[error("WebSocket error: {0}")]
    WebSocket(#[from] tungstenite::Error),

    #[error("RTP error: {0}")]
    Rtp(#[source] Box<dyn std::error::Error + Send + Sync>),

    #[error("Configuration error: {0}")]
    Config(#[from] toml::de::Error),

    #[error("ICE error: {0}")]
    Ice(String),

    #[error("Protocol error: {0}")]
    Protocol(String),

    #[error("Connection closed")]
    ConnectionClosed,
}

impl Error {
    /// Check if this error represents a normal connection closure
    pub fn is_connection_closed(&self) -> bool {
        matches!(
            self,
            Error::ConnectionClosed
                | Error::WebSocket(tungstenite::Error::ConnectionClosed)
        )
    }
}

impl From<rtp::Error> for Error {
    fn from(err: rtp::Error) -> Self {
        Error::Rtp(Box::new(err))
    }
}

impl From<anyhow::Error> for Error {
    fn from(err: anyhow::Error) -> Self {
        Error::Protocol(err.to_string())
    }
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, Error>;`
  },
  'src/connection.rs': {
    old: `use futures::future::BoxFuture;
use futures::pin_mut;
use futures::ready;
use futures::{Future, FutureExt, Sink, Stream};
use libnice::ice;
use mumble_protocol::control::msgs;
use mumble_protocol::control::ControlPacket;
use mumble_protocol::voice::VoicePacket;
use mumble_protocol::voice::VoicePacketPayload;
use mumble_protocol::{Clientbound, Serverbound};
use openssl::asn1::Asn1Time;
use openssl::hash::MessageDigest;
use openssl::pkey::{PKey, Private};
use openssl::rsa::Rsa;
use openssl::ssl::{SslAcceptor, SslAcceptorBuilder, SslMethod};
use openssl::x509::X509;
// ... другие импорты

type SessionId = u32;

struct User {
    session: u32,
    ssrc: u32,
    active: bool,
    timeout: Option<Pin<Box<Sleep>>>,
    start_voice_seq_num: u64,
    highest_voice_seq_num: u64,
    rtp_seq_num_offset: u32,
}

impl User {
    fn set_inactive(&mut self) -> Option<Frame> {
        self.timeout = None;
        if self.active {
            self.active = false;
            self.rtp_seq_num_offset = self.rtp_seq_num_offset
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
    // ... остальные методы
}

pub struct Connection {
    config: Config,
    inbound_client: Pin<Box<dyn Stream<Item = Result<ControlPacket<Serverbound>, Error>> + Send>>,
    outbound_client: Pin<Box<dyn Sink<ControlPacket<Clientbound>, Error = Error> + Send>>,
    inbound_server: Pin<Box<dyn Stream<Item = Result<ControlPacket<Clientbound>, Error>> + Send>>,
    outbound_server: Pin<Box<dyn Sink<ControlPacket<Serverbound>, Error = Error> + Send>>,
    outbound_buf: VecDeque<Frame>,
    ice: Option<(ice::Agent, ice::Stream)>,
    candidate_gathering_done: bool,
    dtls_srtp_future: Option<BoxFuture<'static, Result<DtlsSrtp<...>, io::Error>>>,
    dtls_srtp: Option<DtlsSrtp<...>>,
    dtls_key: PKey<Private>,
    dtls_cert: X509,
    // ... остальные поля
}

impl Connection {
    pub fn new<CSi, CSt, SSi, SSt>(
        config: Config,
        client_sink: CSi,
        client_stream: CSt,
        server_sink: SSi,
        server_stream: SSt,
    ) -> Self
    where
        CSi: Sink<ControlPacket<Clientbound>, Error = Error> + 'static + Send,
        // ... остальные bounds
    {
        let rsa = Rsa::generate(2048).unwrap();
        let key = PKey::from_rsa(rsa).unwrap();
        // ... остальная инициализация с unwrap()
        Self { /* ... */ }
    }

    fn setup_ice(&mut self) -> Result<(), Error> {
        let mut agent = ice::Agent::new_rfc5245();
        agent.set_software("mumble-web-proxy");
        agent.set_controlling_mode(true);
        // ... остальная логика ICE
        println!("Local ice candidate: {}", candidate.to_string());
        Ok(())
    }
    // ... остальные методы
}

impl Future for Connection {
    type Output = Result<(), Error>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context) -> Poll<Result<(), Error>> {
        'poll: loop {
            // ... polling логика
            println!("DTLS-SRTP connection established.");
            return Poll::Pending;
        }
    }
}`,
    new: `//! Connection handler for Mumble-WebRTC proxy
//!
//! This module manages the bidirectional proxy between a WebSocket
//! client and a Mumble server, handling ICE/WebRTC setup, DTLS-SRTP
//! negotiation, and voice packet transcoding.

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
    RtcpCompoundPacket, RtcpPacket, RtcpPacketReader, RtcpPacketWriter,
    RtpFixedHeader, RtpPacket, RtpPacketReader, RtpPacketWriter,
};
use rtp::rfc5761::{MuxPacketReader, MuxPacketWriter, MuxedPacket};
use rtp::rfc5764::DtlsSrtp;
use rtp::traits::{ReadPacket, WritePacket};
use tokio::io;
use tokio::time::Sleep;
use tracing::{debug, error, info, trace, warn};
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
            self.rtp_seq_num_offset = self.rtp_seq_num_offset
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
    dtls_srtp_future: Option<BoxFuture<'static, Result<DtlsSrtp<ice::StreamComponent, SslAcceptorBuilder>, io::Error>>>,
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
        // Generate self-signed certificate for DTLS
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

    /// Initialize ICE agent and send WebRTC details to client
    fn setup_ice(&mut self) -> Result<(), Error> {
        info!("Setting up ICE agent");

        let mut agent = ice::Agent::new_rfc5245();
        agent.set_software("mumble-web-proxy");
        agent.set_controlling_mode(true);

        let mut stream = {
            let mut builder = agent.stream_builder(1);
            if self.config.ice_port_min != 1 || self.config.ice_port_max != u16::MAX {
                builder.set_port_range(self.config.ice_port_min, self.config.ice_port_max);
            }
            builder.build().map_err(|e| Error::Ice(e.to_string()))?
        };

        let component = stream.take_components().pop().expect("Expected one component");

        // Calculate DTLS fingerprint
        let fingerprint = self
            .dtls_cert
            .digest(MessageDigest::sha256())
            .map_err(|e| Error::Protocol(format!("Failed to calculate fingerprint: {}", e)))?
            .iter()
            .map(|byte| format!("{:02X}", byte))
            .collect::<Vec<_>>()
            .join(":");

        // Send WebRTC details to client
        let mut msg = msgs::WebRTC::new();
        msg.set_dtls_fingerprint(fingerprint);
        msg.set_ice_pwd(stream.get_local_pwd().to_owned());
        msg.set_ice_ufrag(stream.get_local_ufrag().to_owned());

        self.ice = Some((agent, stream));

        // Setup DTLS acceptor
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

                // Map to public addresses if configured
                match (&mut candidate.address, self.config.ice_ipv4, self.config.ice_ipv6) {
                    (webrtc_sdp::address::Address::Ip(IpAddr::V4(addr)), Some(public), _) => {
                        *addr = public;
                    }
                    (webrtc_sdp::address::Address::Ip(IpAddr::V6(addr)), _, Some(public)) => {
                        *addr = public;
                    }
                    _ => {}
                }

                let mut msg = msgs::IceCandidate::new();
                msg.set_content(format!("candidate:{}", candidate));
                self.outbound_buf.push_back(Frame::Client(msg.into()));
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
    // ... остальные методы (dispatch_outbound_frames, handle_voice_packet, etc.)
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

            // Check voice timeouts
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
}`
  }
}

type ViewMode = 'code' | 'guide'

export default function App() {
  const [selectedFile, setSelectedFile] = useState<keyof typeof files>('Cargo.toml')
  const [viewMode, setViewMode] = useState<'split' | 'old' | 'new'>('split')
  const [page, setPage] = useState<ViewMode>('code')

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <i className="fas fa-code text-white"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold">mumble-web-proxy</h1>
                <p className="text-xs text-gray-400">Modernized Code Review & Deployment Guide</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Page toggle */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-900 border border-gray-800 mr-2">
                <button
                  onClick={() => setPage('code')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    page === 'code'
                      ? 'bg-violet-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <i className="fas fa-code mr-1.5"></i>
                  Код
                </button>
                <button
                  onClick={() => setPage('guide')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    page === 'guide'
                      ? 'bg-violet-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <i className="fas fa-book mr-1.5"></i>
                  Инструкция
                </button>
              </div>
              <a
                href="https://github.com/ZwerG-MaX/mumble-web-proxy"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                <i className="fab fa-github mr-2"></i>
                <span className="hidden sm:inline">Мой репозиторий</span>
                <span className="sm:hidden">Repo</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {page === 'code' ? (
          <>
            {/* Overview */}
            <ChangesOverview />

            {/* File Explorer */}
            <FileExplorer
              files={Object.keys(files) as Array<keyof typeof files>}
              selectedFile={selectedFile}
              onSelectFile={(file) => setSelectedFile(file as keyof typeof files)}
            />

            {/* View Mode Toggle */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <button
                onClick={() => setViewMode('split')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'split'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <i className="fas fa-columns mr-2"></i>
                Split View
              </button>
              <button
                onClick={() => setViewMode('old')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'old'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <i className="fas fa-file-code mr-2"></i>
                Old Code
              </button>
              <button
                onClick={() => setViewMode('new')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'new'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <i className="fas fa-sparkles mr-2"></i>
                New Code
              </button>
            </div>

            {/* Code Viewer */}
            <CodeViewer
              oldCode={files[selectedFile].old}
              newCode={files[selectedFile].new}
              fileName={selectedFile}
              viewMode={viewMode}
            />
          </>
        ) : (
          <GitGuide />
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>
            Modernized mumble-web-proxy • Original by{' '}
            <a href="https://github.com/Johni0702" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">
              Johni0702
            </a>
            {' '}• Licensed under AGPL-3.0
          </p>
        </div>
      </footer>
    </div>
  )
}
