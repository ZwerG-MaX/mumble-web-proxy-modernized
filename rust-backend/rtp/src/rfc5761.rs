//! RFC 5761: Multiplexing RTP Data and Control Packets

use crate::rfc3550::{
    RtcpCompoundPacket, RtcpPacket, RtcpPacketReader, RtcpPacketWriter, RtpPacket, RtpPacketReader,
    RtpPacketWriter,
};
use crate::traits::{ReadPacket, WritePacket};
use crate::Error;

/// Muxed packet - either RTP or RTCP
#[derive(Debug, Clone, PartialEq)]
pub enum MuxedPacket<R, C> {
    Rtp(R),
    Rtcp(C),
}

/// Reader for muxed RTP/RTCP packets
pub struct MuxPacketReader<R, C> {
    rtp_reader: R,
    rtcp_reader: C,
}

impl<R, C> MuxPacketReader<R, C> {
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

        let second_byte = buf[1];
        let payload_type = second_byte & 0x7F;

        // RTCP payload types are 200-204
        let is_rtcp = payload_type >= 64 && payload_type <= 95;

        if is_rtcp {
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
