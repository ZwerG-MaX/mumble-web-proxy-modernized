//! RFC 3550: RTP - Real-time Transport Protocol
//!
//! This module implements the core RTP packet format and basic RTCP packets.

use byteorder::{BigEndian, ByteOrder, ReadBytesExt, WriteBytesExt};
use std::io::Cursor;

use super::traits::{ReadPacket, WritePacket};
use super::Error;

/// RTP fixed header (first 12 bytes of RTP packet)
#[derive(Debug, Clone, PartialEq)]
pub struct RtpFixedHeader {
    /// Padding flag
    pub padding: bool,
    /// Extension flag
    pub extension: Option<RtpExtension>,
    /// CSRC count
    pub csrc_count: u8,
    /// Marker bit
    pub marker: bool,
    /// Payload type
    pub payload_type: u8,
    /// Sequence number
    pub seq_num: u16,
    /// Timestamp
    pub timestamp: u32,
    /// Synchronization source identifier
    pub ssrc: u32,
    /// Contributing source identifiers
    pub csrc_list: Vec<u32>,
}

/// RTP header extension
#[derive(Debug, Clone, PartialEq)]
pub struct RtpExtension {
    /// Extension profile
    pub profile: u16,
    /// Extension data
    pub data: Vec<u8>,
}

/// Complete RTP packet
#[derive(Debug, Clone, PartialEq)]
pub struct RtpPacket {
    /// RTP header
    pub header: RtpFixedHeader,
    /// Payload data
    pub payload: Vec<u8>,
    /// Padding bytes
    pub padding: Vec<u8>,
}

/// RTCP packet types
#[derive(Debug, Clone, PartialEq)]
pub enum RtcpPacket {
    /// Sender Report (SR)
    SenderReport(RtcpSenderReport),
    /// Receiver Report (RR)
    ReceiverReport(RtcpReceiverReport),
    /// Source Description (SDES)
    SourceDescription(RtcpSdes),
    /// Goodbye (BYE)
    Bye(RtcpBye),
    /// Application-defined (APP)
    App(RtcpApp),
    /// Unknown/unsupported packet type
    Unknown {
        packet_type: u8,
        data: Vec<u8>,
    },
}

/// RTCP Sender Report
#[derive(Debug, Clone, PartialEq)]
pub struct RtcpSenderReport {
    pub ssrc: u32,
    pub ntp_timestamp: u64,
    pub rtp_timestamp: u32,
    pub sender_packet_count: u32,
    pub sender_octet_count: u32,
    pub reports: Vec<RtcpReportBlock>,
}

/// RTCP Receiver Report
#[derive(Debug, Clone, PartialEq)]
pub struct RtcpReceiverReport {
    pub ssrc: u32,
    pub reports: Vec<RtcpReportBlock>,
}

/// RTCP Report Block
#[derive(Debug, Clone, PartialEq)]
pub struct RtcpReportBlock {
    pub ssrc: u32,
    pub fraction_lost: u8,
    pub cumulative_lost: u32,
    pub extended_high_seq_num: u32,
    pub interarrival_jitter: u32,
    pub last_sr_timestamp: u32,
    pub delay_since_last_sr: u32,
}

/// RTCP Source Description
#[derive(Debug, Clone, PartialEq)]
pub struct RtcpSdes {
    pub chunks: Vec<RtcpSdesChunk>,
}

/// RTCP SDES Chunk
#[derive(Debug, Clone, PartialEq)]
pub struct RtcpSdesChunk {
    pub ssrc: u32,
    pub items: Vec<RtcpSdesItem>,
}

/// RTCP SDES Item
#[derive(Debug, Clone, PartialEq)]
pub struct RtcpSdesItem {
    pub item_type: u8,
    pub data: Vec<u8>,
}

/// RTCP Goodbye
#[derive(Debug, Clone, PartialEq)]
pub struct RtcpBye {
    pub ssrcs: Vec<u32>,
    pub reason: Option<String>,
}

/// RTCP Application-defined
#[derive(Debug, Clone, PartialEq)]
pub struct RtcpApp {
    pub ssrc: u32,
    pub name: [u8; 4],
    pub subtype: u8,
    pub data: Vec<u8>,
}

/// RTCP Compound Packet
#[derive(Debug, Clone, PartialEq)]
pub struct RtcpCompoundPacket<P> {
    pub packets: Vec<P>,
}

/// RTP packet reader
pub struct RtpPacketReader;

impl ReadPacket<RtpPacket> for RtpPacketReader {
    fn read_packet(&self, buf: &mut &[u8]) -> crate::Result<RtpPacket> {
        if buf.len() < 12 {
            return Err(Error::BufferTooSmall);
        }

        let first_byte = buf[0];
        let version = (first_byte >> 6) & 0x03;
        if version != 2 {
            return Err(Error::InvalidPacket(format!(
                "Unsupported RTP version: {}",
                version
            )));
        }

        let padding = (first_byte & 0x20) != 0;
        let extension = (first_byte & 0x10) != 0;
        let csrc_count = first_byte & 0x0F;

        let second_byte = buf[1];
        let marker = (second_byte & 0x80) != 0;
        let payload_type = second_byte & 0x7F;

        let seq_num = BigEndian::read_u16(&buf[2..4]);
        let timestamp = BigEndian::read_u32(&buf[4..8]);
        let ssrc = BigEndian::read_u32(&buf[8..12]);

        let mut offset = 12;

        // Read CSRC list
        let mut csrc_list = Vec::with_capacity(csrc_count as usize);
        for _ in 0..csrc_count {
            if buf.len() < offset + 4 {
                return Err(Error::BufferTooSmall);
            }
            csrc_list.push(BigEndian::read_u32(&buf[offset..offset + 4]));
            offset += 4;
        }

        // Read extension if present
        let ext = if extension {
            if buf.len() < offset + 4 {
                return Err(Error::BufferTooSmall);
            }
            let profile = BigEndian::read_u16(&buf[offset..offset + 2]);
            let length = BigEndian::read_u16(&buf[offset + 2..offset + 4]) as usize;
            offset += 4;

            if buf.len() < offset + length * 4 {
                return Err(Error::BufferTooSmall);
            }
            let data = buf[offset..offset + length * 4].to_vec();
            offset += length * 4;

            Some(RtpExtension { profile, data })
        } else {
            None
        };

        // Calculate padding
        let padding_bytes = if padding {
            if buf.is_empty() {
                return Err(Error::BufferTooSmall);
            }
            let pad_len = buf[buf.len() - 1] as usize;
            if buf.len() < offset + pad_len {
                return Err(Error::InvalidPacket("Invalid padding".to_string()));
            }
            pad_len
        } else {
            0
        };

        // Extract payload
        let payload_end = buf.len() - padding_bytes;
        if payload_end < offset {
            return Err(Error::InvalidPacket("Invalid payload length".to_string()));
        }
        let payload = buf[offset..payload_end].to_vec();
        let padding_data = if padding_bytes > 0 {
            buf[buf.len() - padding_bytes..buf.len() - 1].to_vec()
        } else {
            Vec::new()
        };

        // Advance buffer
        *buf = &buf[buf.len()..];

        Ok(RtpPacket {
            header: RtpFixedHeader {
                padding,
                extension: ext,
                csrc_count,
                marker,
                payload_type,
                seq_num,
                timestamp,
                ssrc,
                csrc_list,
            },
            payload,
            padding: padding_data,
        })
    }
}

/// RTP packet writer
pub struct RtpPacketWriter;

impl WritePacket<RtpPacket> for RtpPacketWriter {
    fn write_packet(&self, buf: &mut Vec<u8>, packet: &RtpPacket) -> crate::Result<()> {
        let header = &packet.header;

        // First byte: V=2, P, X, CC
        let mut first_byte: u8 = 0x80; // Version 2
        if header.padding || !packet.padding.is_empty() {
            first_byte |= 0x20;
        }
        if header.extension.is_some() {
            first_byte |= 0x10;
        }
        first_byte |= header.csrc_count & 0x0F;
        buf.push(first_byte);

        // Second byte: M, PT
        let mut second_byte = header.payload_type & 0x7F;
        if header.marker {
            second_byte |= 0x80;
        }
        buf.push(second_byte);

        // Sequence number
        buf.write_u16::<BigEndian>(header.seq_num)
            .map_err(|e| Error::Io(e))?;

        // Timestamp
        buf.write_u32::<BigEndian>(header.timestamp)
            .map_err(|e| Error::Io(e))?;

        // SSRC
        buf.write_u32::<BigEndian>(header.ssrc)
            .map_err(|e| Error::Io(e))?;

        // CSRC list
        for csrc in &header.csrc_list {
            buf.write_u32::<BigEndian>(*csrc)
                .map_err(|e| Error::Io(e))?;
        }

        // Extension
        if let Some(ref ext) = header.extension {
            buf.write_u16::<BigEndian>(ext.profile)
                .map_err(|e| Error::Io(e))?;
            let length = (ext.data.len() + 3) / 4; // Round up to 4-byte boundary
            buf.write_u16::<BigEndian>(length as u16)
                .map_err(|e| Error::Io(e))?;
            buf.extend_from_slice(&ext.data);
            // Pad to 4-byte boundary
            let padding_needed = (4 - (ext.data.len() % 4)) % 4;
            for _ in 0..padding_needed {
                buf.push(0);
            }
        }

        // Payload
        buf.extend_from_slice(&packet.payload);

        // Padding
        if !packet.padding.is_empty() {
            buf.extend_from_slice(&packet.padding);
            buf.push(packet.padding.len() as u8 + 1);
        }

        Ok(())
    }
}

/// RTCP packet reader
pub struct RtcpPacketReader;

impl ReadPacket<RtcpPacket> for RtcpPacketReader {
    fn read_packet(&self, buf: &mut &[u8]) -> crate::Result<RtcpPacket> {
        if buf.len() < 4 {
            return Err(Error::BufferTooSmall);
        }

        let first_byte = buf[0];
        let version = (first_byte >> 6) & 0x03;
        if version != 2 {
            return Err(Error::InvalidPacket(format!(
                "Unsupported RTCP version: {}",
                version
            )));
        }

        let packet_type = buf[1];
        let length = BigEndian::read_u16(&buf[2..4]) as usize;
        let packet_len = (length + 1) * 4;

        if buf.len() < packet_len {
            return Err(Error::BufferTooSmall);
        }

        let packet_data = &buf[4..packet_len];
        *buf = &buf[packet_len..];

        match packet_type {
            200 => read_sender_report(packet_data),
            201 => read_receiver_report(packet_data),
            202 => read_sdes(packet_data),
            203 => read_bye(packet_data),
            204 => read_app(packet_data),
            _ => Ok(RtcpPacket::Unknown {
                packet_type,
                data: packet_data.to_vec(),
            }),
        }
    }
}

fn read_sender_report(data: &[u8]) -> crate::Result<RtcpPacket> {
    if data.len() < 24 {
        return Err(Error::BufferTooSmall);
    }

    let ssrc = BigEndian::read_u32(&data[0..4]);
    let ntp_timestamp = BigEndian::read_u64(&data[4..12]);
    let rtp_timestamp = BigEndian::read_u32(&data[12..16]);
    let sender_packet_count = BigEndian::read_u32(&data[16..20]);
    let sender_octet_count = BigEndian::read_u32(&data[20..24]);

    let mut offset = 24;
    let mut reports = Vec::new();

    while offset + 24 <= data.len() {
        let report = read_report_block(&data[offset..offset + 24])?;
        reports.push(report);
        offset += 24;
    }

    Ok(RtcpPacket::SenderReport(RtcpSenderReport {
        ssrc,
        ntp_timestamp,
        rtp_timestamp,
        sender_packet_count,
        sender_octet_count,
        reports,
    }))
}

fn read_receiver_report(data: &[u8]) -> crate::Result<RtcpPacket> {
    if data.len() < 4 {
        return Err(Error::BufferTooSmall);
    }

    let ssrc = BigEndian::read_u32(&data[0..4]);

    let mut offset = 4;
    let mut reports = Vec::new();

    while offset + 24 <= data.len() {
        let report = read_report_block(&data[offset..offset + 24])?;
        reports.push(report);
        offset += 24;
    }

    Ok(RtcpPacket::ReceiverReport(RtcpReceiverReport { ssrc, reports }))
}

fn read_report_block(data: &[u8]) -> crate::Result<RtcpReportBlock> {
    if data.len() < 24 {
        return Err(Error::BufferTooSmall);
    }

    let ssrc = BigEndian::read_u32(&data[0..4]);
    let fraction_lost = data[4];
    let cumulative_lost = ((data[5] as u32) << 16) | ((data[6] as u32) << 8) | (data[7] as u32);
    let extended_high_seq_num = BigEndian::read_u32(&data[8..12]);
    let interarrival_jitter = BigEndian::read_u32(&data[12..16]);
    let last_sr_timestamp = BigEndian::read_u32(&data[16..20]);
    let delay_since_last_sr = BigEndian::read_u32(&data[20..24]);

    Ok(RtcpReportBlock {
        ssrc,
        fraction_lost,
        cumulative_lost,
        extended_high_seq_num,
        interarrival_jitter,
        last_sr_timestamp,
        delay_since_last_sr,
    })
}

fn read_sdes(data: &[u8]) -> crate::Result<RtcpPacket> {
    let mut offset = 0;
    let mut chunks = Vec::new();

    while offset + 4 <= data.len() {
        let ssrc = BigEndian::read_u32(&data[offset..offset + 4]);
        offset += 4;

        let mut items = Vec::new();
        while offset < data.len() {
            let item_type = data[offset];
            if item_type == 0 {
                offset += 1;
                // Pad to 4-byte boundary
                offset = (offset + 3) & !3;
                break;
            }
            offset += 1;

            if offset >= data.len() {
                break;
            }
            let length = data[offset] as usize;
            offset += 1;

            if offset + length > data.len() {
                break;
            }
            let item_data = data[offset..offset + length].to_vec();
            offset += length;

            items.push(RtcpSdesItem {
                item_type,
                data: item_data,
            });
        }

        chunks.push(RtcpSdesChunk { ssrc, items });
    }

    Ok(RtcpPacket::SourceDescription(RtcpSdes { chunks }))
}

fn read_bye(data: &[u8]) -> crate::Result<RtcpPacket> {
    let mut offset = 0;
    let mut ssrcs = Vec::new();

    while offset + 4 <= data.len() {
        ssrcs.push(BigEndian::read_u32(&data[offset..offset + 4]));
        offset += 4;
    }

    let reason = if offset < data.len() {
        let reason_len = data[offset] as usize;
        offset += 1;
        if offset + reason_len <= data.len() {
            Some(String::from_utf8_lossy(&data[offset..offset + reason_len]).to_string())
        } else {
            None
        }
    } else {
        None
    };

    Ok(RtcpPacket::Bye(RtcpBye { ssrcs, reason }))
}

fn read_app(data: &[u8]) -> crate::Result<RtcpPacket> {
    if data.len() < 8 {
        return Err(Error::BufferTooSmall);
    }

    let ssrc = BigEndian::read_u32(&data[0..4]);
    let mut name = [0u8; 4];
    name.copy_from_slice(&data[4..8]);

    let subtype = data[0] & 0x1F; // From first byte
    let app_data = if data.len() > 8 {
        data[8..].to_vec()
    } else {
        Vec::new()
    };

    Ok(RtcpPacket::App(RtcpApp {
        ssrc,
        name,
        subtype,
        data: app_data,
    }))
}

/// RTCP packet writer
pub struct RtcpPacketWriter;

impl WritePacket<RtcpPacket> for RtcpPacketWriter {
    fn write_packet(&self, buf: &mut Vec<u8>, packet: &RtcpPacket) -> crate::Result<()> {
        match packet {
            RtcpPacket::SenderReport(sr) => write_sender_report(buf, sr),
            RtcpPacket::ReceiverReport(rr) => write_receiver_report(buf, rr),
            RtcpPacket::SourceDescription(sdes) => write_sdes(buf, sdes),
            RtcpPacket::Bye(bye) => write_bye(buf, bye),
            RtcpPacket::App(app) => write_app(buf, app),
            RtcpPacket::Unknown { packet_type, data } => {
                write_unknown(buf, *packet_type, data)
            }
        }
    }
}

fn write_sender_report(buf: &mut Vec<u8>, sr: &RtcpSenderReport) -> crate::Result<()> {
    let length = 6 + sr.reports.len() * 6; // In 32-bit words

    buf.push(0x80); // V=2, P=0, RC=0
    buf.push(200); // PT=SR
    buf.write_u16::<BigEndian>(length as u16)
        .map_err(|e| Error::Io(e))?;
    buf.write_u32::<BigEndian>(sr.ssrc)
        .map_err(|e| Error::Io(e))?;
    buf.write_u64::<BigEndian>(sr.ntp_timestamp)
        .map_err(|e| Error::Io(e))?;
    buf.write_u32::<BigEndian>(sr.rtp_timestamp)
        .map_err(|e| Error::Io(e))?;
    buf.write_u32::<BigEndian>(sr.sender_packet_count)
        .map_err(|e| Error::Io(e))?;
    buf.write_u32::<BigEndian>(sr.sender_octet_count)
        .map_err(|e| Error::Io(e))?;

    for report in &sr.reports {
        write_report_block(buf, report)?;
    }

    Ok(())
}

fn write_receiver_report(buf: &mut Vec<u8>, rr: &RtcpReceiverReport) -> crate::Result<()> {
    let length = 1 + rr.reports.len() * 6;

    buf.push(0x80);
    buf.push(201);
    buf.write_u16::<BigEndian>(length as u16)
        .map_err(|e| Error::Io(e))?;
    buf.write_u32::<BigEndian>(rr.ssrc)
        .map_err(|e| Error::Io(e))?;

    for report in &rr.reports {
        write_report_block(buf, report)?;
    }

    Ok(())
}

fn write_report_block(buf: &mut Vec<u8>, report: &RtcpReportBlock) -> crate::Result<()> {
    buf.write_u32::<BigEndian>(report.ssrc)
        .map_err(|e| Error::Io(e))?;
    buf.push(report.fraction_lost);
    buf.push(((report.cumulative_lost >> 16) & 0xFF) as u8);
    buf.push(((report.cumulative_lost >> 8) & 0xFF) as u8);
    buf.push((report.cumulative_lost & 0xFF) as u8);
    buf.write_u32::<BigEndian>(report.extended_high_seq_num)
        .map_err(|e| Error::Io(e))?;
    buf.write_u32::<BigEndian>(report.interarrival_jitter)
        .map_err(|e| Error::Io(e))?;
    buf.write_u32::<BigEndian>(report.last_sr_timestamp)
        .map_err(|e| Error::Io(e))?;
    buf.write_u32::<BigEndian>(report.delay_since_last_sr)
        .map_err(|e| Error::Io(e))?;

    Ok(())
}

fn write_sdes(buf: &mut Vec<u8>, sdes: &RtcpSdes) -> crate::Result<()> {
    // Calculate length
    let mut length = 0;
    for chunk in &sdes.chunks {
        length += 1; // SSRC
        for item in &chunk.items {
            length += 1; // type + length
            length += (item.data.len() + 3) / 4; // data padded to 4 bytes
        }
        length += 1; // END item
        length = (length + 3) / 4 * 4; // Pad to 4-byte boundary
    }

    buf.push(0x80 | (sdes.chunks.len() as u8 & 0x1F));
    buf.push(202);
    buf.write_u16::<BigEndian>(length as u16)
        .map_err(|e| Error::Io(e))?;

    for chunk in &sdes.chunks {
        buf.write_u32::<BigEndian>(chunk.ssrc)
            .map_err(|e| Error::Io(e))?;

        for item in &chunk.items {
            buf.push(item.item_type);
            buf.push(item.data.len() as u8);
            buf.extend_from_slice(&item.data);
            let padding_needed = (4 - (item.data.len() % 4)) % 4;
            for _ in 0..padding_needed {
                buf.push(0);
            }
        }

        buf.push(0); // END
        let padding_needed = (4 - ((buf.len() % 4))) % 4;
        for _ in 0..padding_needed {
            buf.push(0);
        }
    }

    Ok(())
}

fn write_bye(buf: &mut Vec<u8>, bye: &RtcpBye) -> crate::Result<()> {
    let mut length = bye.ssrcs.len();
    if let Some(ref reason) = bye.reason {
        length += (1 + reason.len() + 3) / 4;
    }

    buf.push(0x80 | (bye.ssrcs.len() as u8 & 0x1F));
    buf.push(203);
    buf.write_u16::<BigEndian>(length as u16)
        .map_err(|e| Error::Io(e))?;

    for ssrc in &bye.ssrcs {
        buf.write_u32::<BigEndian>(*ssrc)
            .map_err(|e| Error::Io(e))?;
    }

    if let Some(ref reason) = bye.reason {
        buf.push(reason.len() as u8);
        buf.extend_from_slice(reason.as_bytes());
        let padding_needed = (4 - ((reason.len() + 1) % 4)) % 4;
        for _ in 0..padding_needed {
            buf.push(0);
        }
    }

    Ok(())
}

fn write_app(buf: &mut Vec<u8>, app: &RtcpApp) -> crate::Result<()> {
    let length = 2 + (app.data.len() + 3) / 4;

    buf.push(0x80 | (app.subtype & 0x1F));
    buf.push(204);
    buf.write_u16::<BigEndian>(length as u16)
        .map_err(|e| Error::Io(e))?;
    buf.write_u32::<BigEndian>(app.ssrc)
        .map_err(|e| Error::Io(e))?;
    buf.extend_from_slice(&app.name);
    buf.extend_from_slice(&app.data);

    let padding_needed = (4 - (app.data.len() % 4)) % 4;
    for _ in 0..padding_needed {
        buf.push(0);
    }

    Ok(())
}

fn write_unknown(buf: &mut Vec<u8>, packet_type: u8, data: &[u8]) -> crate::Result<()> {
    let length = (data.len() + 3) / 4;

    buf.push(0x80);
    buf.push(packet_type);
    buf.write_u16::<BigEndian>(length as u16)
        .map_err(|e| Error::Io(e))?;
    buf.extend_from_slice(data);

    let padding_needed = (4 - (data.len() % 4)) % 4;
    for _ in 0..padding_needed {
        buf.push(0);
    }

    Ok(())
}
