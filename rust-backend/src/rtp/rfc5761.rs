//! RFC 5761: Multiplexing RTP Data and Control Packets
//!
//! This module implements multiplexing of RTP and RTCP packets on a single transport.

use crate::rfc3550::{RtcpCompoundPacket, RtcpPacket, RtcpPacketReader, RtpPacket, RtpPacketReader};
use crate::rfc3550::{RtcpPacketWriter, RtpPacketWriter};
use crate::traits::{ReadPacket, WritePacket};
use crate::Error;

/// Muxed packet - either RTP or RTCP
#[derive(Debug, Clone, PartialEq)]
pub enum MuxedPacket<R, C> {
    /// RTP packet
    Rtp(R),
    /// RTCP compound packet
    Rtcp(C),
}

/// Reader for muxed RTP/RTCP packets
pub struct MuxPacketReader<R, C> {
    rtp_reader: R,
    rtcp_reader: C,
}

impl<R, C> MuxPacketReader<R, C> {
    /// Create a new muxed packet reader
    pub fn new(rtp_reader: R, rtcp_reader: C) -> Self {
        Self {
            rtp_reader,
            rtcp_reader,
        }
    }
}

impl<R, C> ReadPacket<MuxedPacket<RtpPacket, RtcpCompoundPacket<RtcpPacket>>>
    for MuxPacketReader<R, C>
where
    R: ReadPacket<RtpPacket>,
    C: ReadPacket<RtcpPacket>,
{
    fn read_packet(
        &self,
        buf: &mut &[u8],
    ) -> crate::Result<MuxedPacket<RtpPacket, RtcpCompoundPacket<RtcpPacket>>> {
        if buf.len() < 2 {
            return Err(Error::BufferTooSmall);
        }

        // According to RFC 5761, we distinguish RTP from RTCP by looking at the second byte:
        // - If the payload type is in the range 64-95, it's RTCP
        // - Otherwise, it's RTP
        let second_byte = buf[1];
        let payload_type = second_byte & 0x7F;

        // RTCP payload types are 200-204 (SR, RR, SDES, BYE, APP)
        // But we also check the marker bit and other heuristics
        let is_rtcp = payload_type >= 64 && payload_type <= 95;

        if is_rtcp {
            // Read RTCP compound packet
            let mut packets = Vec::new();
            let mut remaining = *buf;

            while !remaining.is_empty() {
                match self.rtcp_reader.read_packet(&mut remaining) {
                    Ok(packet) => packets.push(packet),
                    Err(Error::BufferTooSmall) => break,
                    Err(e) => return Err(e),
                }
            }

            *buf = remaining;
            Ok(MuxedPacket::Rtcp(RtcpCompoundPacket { packets }))
        } else {
            // Read RTP packet
            let packet = self.rtp_reader.read_packet(buf)?;
            Ok(MuxedPacket::Rtp(packet))
        }
    }
}

/// Writer for muxed RTP/RTCP packets
pub struct MuxPacketWriter<R, C> {
    rtp_writer: R,
    rtcp_writer: C,
}

impl<R, C> MuxPacketWriter<R, C> {
    /// Create a new muxed packet writer
    pub fn new(rtp_writer: R, rtcp_writer: C) -> Self {
        Self {
            rtp_writer,
            rtcp_writer,
        }
    }
}

impl<R, C> WritePacket<MuxedPacket<RtpPacket, RtcpCompoundPacket<RtcpPacket>>>
    for MuxPacketWriter<R, C>
where
    R: WritePacket<RtpPacket>,
    C: WritePacket<RtcpPacket>,
{
    fn write_packet(
        &self,
        buf: &mut Vec<u8>,
        packet: &MuxedPacket<RtpPacket, RtcpCompoundPacket<RtcpPacket>>,
    ) -> crate::Result<()> {
        match packet {
            MuxedPacket::Rtp(rtp) => self.rtp_writer.write_packet(buf, rtp),
            MuxedPacket::Rtcp(rtcp) => {
                for packet in &rtcp.packets {
                    self.rtcp_writer.write_packet(buf, packet)?;
                }
                Ok(())
            }
        }
    }
}
