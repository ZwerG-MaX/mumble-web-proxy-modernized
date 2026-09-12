//! RFC 3550: RTP - Real-time Transport Protocol

use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};
use std::io::Cursor;

use crate::traits::{ReadPacket, WritePacket};
use crate::Error;

/// RTP fixed header
#[derive(Debug, Clone, PartialEq)]
pub struct RtpFixedHeader {
    pub padding: bool,
    pub extension: Option<RtpExtension>,
    pub csrc_count: u8,
    pub marker: bool,
    pub payload_type: u8,
    pub seq_num: u16,
    pub timestamp: u32,
    pub ssrc: u32,
    pub csrc_list: Vec<u32>,
}

/// RTP header extension
#[derive(Debug, Clone, PartialEq)]
pub struct RtpExtension {
    pub profile: u16,
    pub data: Vec<u8>,
}

/// Complete RTP packet
#[derive(Debug, Clone, PartialEq)]
pub struct RtpPacket {
    pub header: RtpFixedHeader,
    pub payload: Vec<u8>,
    pub padding: Vec<u8>,
}

/// RTCP packet types
#[derive(Debug, Clone, PartialEq)]
pub enum RtcpPacket {
    SenderReport(RtcpSenderReport),
    ReceiverReport(RtcpReceiverReport),
    SourceDescription(RtcpSdes),
    Bye(RtcpBye),
    App(RtcpApp),
    Unknown { packet_type: u8, data: Vec<u8> },
}

#[derive(Debug, Clone, PartialEq)]
pub struct RtcpSenderReport {
    pub ssrc: u32,
    pub ntp_timestamp: u64,
    pub rtp_timestamp: u32,
    pub sender_packet_count: u32,
    pub sender_octet_count: u32,
    pub reports: Vec<RtcpReportBlock>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RtcpReceiverReport {
    pub ssrc: u32,
    pub reports: Vec<RtcpReportBlock>,
}

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

#[derive(Debug, Clone, PartialEq)]
pub struct RtcpSdes {
    pub chunks: Vec<RtcpSdesChunk>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RtcpSdesChunk {
    pub ssrc: u32,
    pub items: Vec<RtcpSdesItem>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RtcpSdesItem {
    pub item_type: u8,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RtcpBye {
    pub ssrcs: Vec<u32>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RtcpApp {
    pub ssrc: u32,
    pub name: [u8; 4],
    pub subtype: u8,
    pub data: Vec<u8>,
}

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
            return Err(Error::InvalidPacket(format!("Unsupported RTP version: {}", version)));
        }

        let padding = (first_byte & 0x20) != 0;
        let extension = (first_byte & 0x10) != 0;
        let csrc_count = first_byte & 0x0F;

        let second_byte = buf[1];
        let marker = (second_byte & 0x80) != 0;
        let payload_type = second_byte & 0x7F;

        let mut cursor = Cursor::new(&buf[2..]);
        let seq_num = cursor.read_u16::<BigEndian>().map_err(|e| Error::Io(e))?;
        let timestamp = cursor.read_u32::<BigEndian>().map_err(|e| Error::Io(e))?;
        let ssrc = cursor.read_u32::<BigEndian>().map_err(|e| Error::Io(e))?;

        let mut offset = 12;
        let mut csrc_list = Vec::with_capacity(csrc_count as usize);
        for _ in 0..csrc_count {
            if buf.len() < offset + 4 {
                return Err(Error::BufferTooSmall);
            }
            let mut c = Cursor::new(&buf[offset..offset + 4]);
            csrc_list.push(c.read_u32::<BigEndian>().map_err(|e| Error::Io(e))?);
            offset += 4;
        }

        let ext = if extension {
            if buf.len() < offset + 4 {
                return Err(Error::BufferTooSmall);
            }
            let mut c = Cursor::new(&buf[offset..offset + 4]);
            let profile = c.read_u16::<BigEndian>().map_err(|e| Error::Io(e))?;
            let length = c.read_u16::<BigEndian>().map_err(|e| Error::Io(e))? as usize;
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

        let padding_bytes = if padding {
            if buf.is_empty() {
                return Err(Error::BufferTooSmall);
            }
            buf[buf.len() - 1] as usize
        } else {
            0
        };

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

        let mut first_byte: u8 = 0x80;
        if header.padding || !packet.padding.is_empty() {
            first_byte |= 0x20;
        }
        if header.extension.is_some() {
            first_byte |= 0x10;
        }
        first_byte |= header.csrc_count & 0x0F;
        buf.push(first_byte);

        let mut second_byte = header.payload_type & 0x7F;
        if header.marker {
            second_byte |= 0x80;
        }
        buf.push(second_byte);

        buf.write_u16::<BigEndian>(header.seq_num).map_err(Error::Io)?;
        buf.write_u32::<BigEndian>(header.timestamp).map_err(Error::Io)?;
        buf.write_u32::<BigEndian>(header.ssrc).map_err(Error::Io)?;

        for csrc in &header.csrc_list {
            buf.write_u32::<BigEndian>(*csrc).map_err(Error::Io)?;
        }

        if let Some(ref ext) = header.extension {
            buf.write_u16::<BigEndian>(ext.profile).map_err(Error::Io)?;
            let length = (ext.data.len() + 3) / 4;
            buf.write_u16::<BigEndian>(length as u16).map_err(Error::Io)?;
            buf.extend_from_slice(&ext.data);
            let padding_needed = (4 - (ext.data.len() % 4)) % 4;
            for _ in 0..padding_needed {
                buf.push(0);
            }
        }

        buf.extend_from_slice(&packet.payload);

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
            return Err(Error::InvalidPacket(format!("Unsupported RTCP version: {}", version)));
        }

        let packet_type = buf[1];
        let mut cursor = Cursor::new(&buf[2..4]);
        let length = cursor.read_u16::<BigEndian>().map_err(Error::Io)? as usize;
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

    let mut cursor = Cursor::new(data);
    let ssrc = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;
    let ntp_timestamp = cursor.read_u64::<BigEndian>().map_err(Error::Io)?;
    let rtp_timestamp = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;
    let sender_packet_count = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;
    let sender_octet_count = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;

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

    let mut cursor = Cursor::new(data);
    let ssrc = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;

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

    let mut cursor = Cursor::new(data);
    let ssrc = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;
    let fraction_lost = data[4];
    let cumulative_lost = ((data[5] as u32) << 16) | ((data[6] as u32) << 8) | (data[7] as u32);
    let extended_high_seq_num = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;
    let interarrival_jitter = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;
    let last_sr_timestamp = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;
    let delay_since_last_sr = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;

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
        let mut cursor = Cursor::new(&data[offset..offset + 4]);
        let ssrc = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;
        offset += 4;

        let mut items = Vec::new();
        while offset < data.len() {
            let item_type = data[offset];
            if item_type == 0 {
                offset += 1;
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

            items.push(RtcpSdesItem { item_type, data: item_data });
        }

        chunks.push(RtcpSdesChunk { ssrc, items });
    }

    Ok(RtcpPacket::SourceDescription(RtcpSdes { chunks }))
}

fn read_bye(data: &[u8]) -> crate::Result<RtcpPacket> {
    let mut offset = 0;
    let mut ssrcs = Vec::new();

    while offset + 4 <= data.len() {
        let mut cursor = Cursor::new(&data[offset..offset + 4]);
        ssrcs.push(cursor.read_u32::<BigEndian>().map_err(Error::Io)?);
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

    let mut cursor = Cursor::new(data);
    let ssrc = cursor.read_u32::<BigEndian>().map_err(Error::Io)?;
    let mut name = [0u8; 4];
    name.copy_from_slice(&data[4..8]);

    let subtype = data[0] & 0x1F;
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
            RtcpPacket::Unknown { packet_type, data } => write_unknown(buf, *packet_type, data),
        }
    }
}

fn write_sender_report(buf: &mut Vec<u8>, sr: &RtcpSenderReport) -> crate::Result<()> {
    let length = 6 + sr.reports.len() * 6;

    buf.push(0x80);
    buf.push(200);
    buf.write_u16::<BigEndian>(length as u16).map_err(Error::Io)?;
    buf.write_u32::<BigEndian>(sr.ssrc).map_err(Error::Io)?;
    buf.write_u64::<BigEndian>(sr.ntp_timestamp).map_err(Error::Io)?;
    buf.write_u32::<BigEndian>(sr.rtp_timestamp).map_err(Error::Io)?;
    buf.write_u32::<BigEndian>(sr.sender_packet_count).map_err(Error::Io)?;
    buf.write_u32::<BigEndian>(sr.sender_octet_count).map_err(Error::Io)?;

    for report in &sr.reports {
        write_report_block(buf, report)?;
    }

    Ok(())
}

fn write_receiver_report(buf: &mut Vec<u8>, rr: &RtcpReceiverReport) -> crate::Result<()> {
    let length = 1 + rr.reports.len() * 6;

    buf.push(0x80);
    buf.push(201);
    buf.write_u16::<BigEndian>(length as u16).map_err(Error::Io)?;
    buf.write_u32::<BigEndian>(rr.ssrc).map_err(Error::Io)?;

    for report in &rr.reports {
        write_report_block(buf, report)?;
    }

    Ok(())
}

fn write_report_block(buf: &mut Vec<u8>, report: &RtcpReportBlock) -> crate::Result<()> {
    buf.write_u32::<BigEndian>(report.ssrc).map_err(Error::Io)?;
    buf.push(report.fraction_lost);
    buf.push(((report.cumulative_lost >> 16) & 0xFF) as u8);
    buf.push(((report.cumulative_lost >> 8) & 0xFF) as u8);
    buf.push((report.cumulative_lost & 0xFF) as u8);
    buf.write_u32::<BigEndian>(report.extended_high_seq_num).map_err(Error::Io)?;
    buf.write_u32::<BigEndian>(report.interarrival_jitter).map_err(Error::Io)?;
    buf.write_u32::<BigEndian>(report.last_sr_timestamp).map_err(Error::Io)?;
    buf.write_u32::<BigEndian>(report.delay_since_last_sr).map_err(Error::Io)?;

    Ok(())
}

fn write_sdes(buf: &mut Vec<u8>, sdes: &RtcpSdes) -> crate::Result<()> {
    let mut length = 0;
    for chunk in &sdes.chunks {
        length += 1;
        for item in &chunk.items {
            length += 1;
            length += (item.data.len() + 3) / 4;
        }
        length += 1;
        length = (length + 3) / 4 * 4;
    }

    buf.push(0x80 | (sdes.chunks.len() as u8 & 0x1F));
    buf.push(202);
    buf.write_u16::<BigEndian>(length as u16).map_err(Error::Io)?;

    for chunk in &sdes.chunks {
        buf.write_u32::<BigEndian>(chunk.ssrc).map_err(Error::Io)?;

        for item in &chunk.items {
            buf.push(item.item_type);
            buf.push(item.data.len() as u8);
            buf.extend_from_slice(&item.data);
            let padding_needed = (4 - (item.data.len() % 4)) % 4;
            for _ in 0..padding_needed {
                buf.push(0);
            }
        }

        buf.push(0);
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
    buf.write_u16::<BigEndian>(length as u16).map_err(Error::Io)?;

    for ssrc in &bye.ssrcs {
        buf.write_u32::<BigEndian>(*ssrc).map_err(Error::Io)?;
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
    buf.write_u16::<BigEndian>(length as u16).map_err(Error::Io)?;
    buf.write_u32::<BigEndian>(app.ssrc).map_err(Error::Io)?;
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
    buf.write_u16::<BigEndian>(length as u16).map_err(Error::Io)?;
    buf.extend_from_slice(data);

    let padding_needed = (4 - (data.len() % 4)) % 4;
    for _ in 0..padding_needed {
        buf.push(0);
    }

    Ok(())
}
