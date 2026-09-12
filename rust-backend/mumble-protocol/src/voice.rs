//! Voice packet types and parsing

use crate::msgs;
use bytes::Bytes;
use std::marker::PhantomData;

/// Voice packet types
#[derive(Debug, Clone)]
pub enum VoicePacket<D> {
    /// Audio packet with Opus data
    Audio {
        _dst: PhantomData<D>,
        target: u8,
        session_id: u32,
        seq_num: u64,
        payload: VoicePacketPayload,
        position_info: Option<[i32; 3]>,
    },
    /// Ping packet
    Ping {
        _dst: PhantomData<D>,
        timestamp: u64,
    },
}

/// Voice packet payload types
#[derive(Debug, Clone)]
pub enum VoicePacketPayload {
    /// CELT encoded audio
    Celt(Bytes, bool),
    /// Speex encoded audio
    Speex(Bytes, bool),
    /// Opus encoded audio
    Opus(Bytes, bool),
}

impl<D> VoicePacket<D> {
    /// Parse voice packet from UDP tunnel message
    pub fn from_tunnel(tunnel: &msgs::UdpTunnel) -> Result<Self, crate::ProtocolError> {
        let data = &tunnel.packet;
        if data.is_empty() {
            return Err(crate::ProtocolError::DecodeError(
                "Empty voice packet".to_string(),
            ));
        }

        let header = data[0];
        let kind = (header >> 5) & 0x07;
        let target = header & 0x1f;

        match kind {
            // Audio packets (types 0-4)
            0..=4 => Self::parse_audio(data, target),
            // Ping packet (type 5)
            5 => Self::parse_ping(data),
            _ => Err(crate::ProtocolError::DecodeError(format!(
                "Unknown voice packet kind: {}",
                kind
            ))),
        }
    }

    fn parse_audio(data: &[u8], target: u8) -> Result<Self, crate::ProtocolError> {
        if data.len() < 2 {
            return Err(crate::ProtocolError::DecodeError(
                "Audio packet too short".to_string(),
            ));
        }

        let header = data[0];
        let kind = (header >> 5) & 0x07;

        // Parse session ID (varint)
        let (session_id, mut offset) = Self::read_varint(&data[1..])?;

        // Parse sequence number (varint)
        let (seq_num, varint_len) = Self::read_varint(&data[offset..])?;
        offset += varint_len;

        // Parse payload based on codec type
        let payload = match kind {
            0 => {
                // CELT
                let (payload, last) = Self::read_audio_payload(&data[offset..])?;
                VoicePacketPayload::Celt(payload, last)
            }
            1 => {
                // Speex
                let (payload, last) = Self::read_audio_payload(&data[offset..])?;
                VoicePacketPayload::Speex(payload, last)
            }
            4 => {
                // Opus
                let (payload, last) = Self::read_audio_payload(&data[offset..])?;
                VoicePacketPayload::Opus(payload, last)
            }
            _ => {
                return Err(crate::ProtocolError::DecodeError(format!(
                    "Unsupported codec type: {}",
                    kind
                )));
            }
        };

        // Check for position info (if bit 4 is set in header)
        let position_info = if (header & 0x10) != 0 {
            if data.len() >= offset + 12 {
                let x = i32::from_le_bytes([
                    data[offset],
                    data[offset + 1],
                    data[offset + 2],
                    data[offset + 3],
                ]);
                let y = i32::from_le_bytes([
                    data[offset + 4],
                    data[offset + 5],
                    data[offset + 6],
                    data[offset + 7],
                ]);
                let z = i32::from_le_bytes([
                    data[offset + 8],
                    data[offset + 9],
                    data[offset + 10],
                    data[offset + 11],
                ]);
                Some([x, y, z])
            } else {
                None
            }
        } else {
            None
        };

        Ok(VoicePacket::Audio {
            _dst: PhantomData,
            target,
            session_id,
            seq_num,
            payload,
            position_info,
        })
    }

    fn parse_ping(data: &[u8]) -> Result<Self, crate::ProtocolError> {
        if data.len() < 2 {
            return Err(crate::ProtocolError::DecodeError(
                "Ping packet too short".to_string(),
            ));
        }

        let (timestamp, _) = Self::read_varint(&data[1..])?;

        Ok(VoicePacket::Ping {
            _dst: PhantomData,
            timestamp,
        })
    }

    fn read_varint(data: &[u8]) -> Result<(u64, usize), crate::ProtocolError> {
        let mut value: u64 = 0;
        let mut shift = 0;
        let mut offset = 0;

        loop {
            if offset >= data.len() {
                return Err(crate::ProtocolError::DecodeError(
                    "Varint too short".to_string(),
                ));
            }

            let byte = data[offset];
            offset += 1;

            value |= ((byte & 0x7f) as u64) << shift;

            if (byte & 0x80) == 0 {
                break;
            }

            shift += 7;
            if shift > 63 {
                return Err(crate::ProtocolError::DecodeError(
                    "Varint too large".to_string(),
                ));
            }
        }

        Ok((value, offset))
    }

    fn read_audio_payload(data: &[u8]) -> Result<(Bytes, bool), crate::ProtocolError> {
        if data.is_empty() {
            return Err(crate::ProtocolError::DecodeError(
                "Empty audio payload".to_string(),
            ));
        }

        // Read length (varint)
        let (length, varint_len) = Self::read_varint(data)?;

        if length == 0 {
            // Last packet in transmission
            return Ok((Bytes::new(), true));
        }

        let start = varint_len;
        let end = start + length as usize;

        if end > data.len() {
            return Err(crate::ProtocolError::DecodeError(
                "Audio payload too short".to_string(),
            ));
        }

        let payload = Bytes::copy_from_slice(&data[start..end]);
        Ok((payload, false))
    }

    /// Convert voice packet to UDP tunnel message
    pub fn to_tunnel(&self) -> msgs::UdpTunnel {
        let mut data = Vec::new();

        match self {
            VoicePacket::Audio {
                target,
                session_id,
                seq_num,
                payload,
                position_info,
                ..
            } => {
                // Determine codec type
                let kind = match payload {
                    VoicePacketPayload::Celt(_, _) => 0,
                    VoicePacketPayload::Speex(_, _) => 1,
                    VoicePacketPayload::Opus(_, _) => 4,
                };

                // Header byte
                let mut header = (kind << 5) | (target & 0x1f);
                if position_info.is_some() {
                    header |= 0x10;
                }
                data.push(header);

                // Session ID (varint)
                Self::write_varint(&mut data, *session_id);

                // Sequence number (varint)
                Self::write_varint(&mut data, *seq_num);

                // Payload
                match payload {
                    VoicePacketPayload::Celt(bytes, last)
                    | VoicePacketPayload::Speex(bytes, last)
                    | VoicePacketPayload::Opus(bytes, last) => {
                        if *last {
                            data.push(0); // Length 0 = last packet
                        } else {
                            Self::write_varint(&mut data, bytes.len() as u64);
                            data.extend_from_slice(bytes);
                        }
                    }
                }

                // Position info
                if let Some([x, y, z]) = position_info {
                    data.extend_from_slice(&x.to_le_bytes());
                    data.extend_from_slice(&y.to_le_bytes());
                    data.extend_from_slice(&z.to_le_bytes());
                }
            }
            VoicePacket::Ping { timestamp, .. } => {
                data.push(0x20); // Kind 5 = ping
                Self::write_varint(&mut data, *timestamp);
            }
        }

        msgs::UdpTunnel {
            packet: data,
        }
    }

    fn write_varint(data: &mut Vec<u8>, mut value: u64) {
        loop {
            let mut byte = (value & 0x7f) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80;
            }
            data.push(byte);
            if value == 0 {
                break;
            }
        }
    }
}
