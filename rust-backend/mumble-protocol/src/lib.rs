//! Modern Rust implementation of the Mumble protocol
//!
//! This crate provides types and codecs for the Mumble VoIP protocol,
//! compatible with Rust 1.88+ and edition 2021.

pub mod control;
pub mod voice;

// Re-export generated protobuf types
pub mod msgs {
    include!(concat!(env!("OUT_DIR"), "/MumbleProto.rs"));
}

use bytes::{Buf, BufMut, Bytes, BytesMut};
use thiserror::Error;
use tokio_util::codec::{Decoder, Encoder};

/// Error type for protocol operations
#[derive(Error, Debug)]
pub enum ProtocolError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid message type: {0}")]
    InvalidMessageType(u16),

    #[error("Message too large: {0} bytes")]
    MessageTooLarge(usize),

    #[error("Protobuf decode error: {0}")]
    DecodeError(String),

    #[error("Protobuf encode error: {0}")]
    EncodeError(String),
}

pub type Result<T> = std::result::Result<T, ProtocolError>;

/// Message type IDs for Mumble protocol
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u16)]
pub enum MessageType {
    Version = 0,
    UdpTunnel = 1,
    Authenticate = 2,
    Ping = 3,
    Reject = 4,
    ServerSync = 5,
    ChannelRemove = 6,
    ChannelState = 7,
    UserRemove = 8,
    UserState = 9,
    BanList = 10,
    TextMessage = 11,
    PermissionDenied = 12,
    Acl = 13,
    QueryUsers = 14,
    CryptSetup = 15,
    ContextActionModify = 16,
    ContextAction = 17,
    UserList = 18,
    VoiceTarget = 19,
    PermissionQuery = 20,
    CodecVersion = 21,
    UserStats = 22,
    RequestBlob = 23,
    ServerConfig = 24,
    SuggestedConfig = 25,
    // WebRTC extensions
    WebRtc = 30,
    IceCandidate = 31,
    TalkingState = 32,
}

impl TryFrom<u16> for MessageType {
    type Error = ProtocolError;

    fn try_from(value: u16) -> Result<Self> {
        match value {
            0 => Ok(MessageType::Version),
            1 => Ok(MessageType::UdpTunnel),
            2 => Ok(MessageType::Authenticate),
            3 => Ok(MessageType::Ping),
            4 => Ok(MessageType::Reject),
            5 => Ok(MessageType::ServerSync),
            6 => Ok(MessageType::ChannelRemove),
            7 => Ok(MessageType::ChannelState),
            8 => Ok(MessageType::UserRemove),
            9 => Ok(MessageType::UserState),
            10 => Ok(MessageType::BanList),
            11 => Ok(MessageType::TextMessage),
            12 => Ok(MessageType::PermissionDenied),
            13 => Ok(MessageType::Acl),
            14 => Ok(MessageType::QueryUsers),
            15 => Ok(MessageType::CryptSetup),
            16 => Ok(MessageType::ContextActionModify),
            17 => Ok(MessageType::ContextAction),
            18 => Ok(MessageType::UserList),
            19 => Ok(MessageType::VoiceTarget),
            20 => Ok(MessageType::PermissionQuery),
            21 => Ok(MessageType::CodecVersion),
            22 => Ok(MessageType::UserStats),
            23 => Ok(MessageType::RequestBlob),
            24 => Ok(MessageType::ServerConfig),
            25 => Ok(MessageType::SuggestedConfig),
            30 => Ok(MessageType::WebRtc),
            31 => Ok(MessageType::IceCandidate),
            32 => Ok(MessageType::TalkingState),
            _ => Err(ProtocolError::InvalidMessageType(value)),
        }
    }
}

/// Raw control packet with type ID and bytes
#[derive(Debug, Clone)]
pub struct RawControlPacket {
    pub id: u16,
    pub bytes: Bytes,
}

/// Codec for Mumble control messages
pub struct ControlCodec;

impl ControlCodec {
    pub fn new() -> Self {
        Self
    }
}

impl Default for ControlCodec {
    fn default() -> Self {
        Self::new()
    }
}

impl Decoder for ControlCodec {
    type Item = RawControlPacket;
    type Error = ProtocolError;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>> {
        if src.len() < 6 {
            return Ok(None);
        }

        let mut buf = &src[..];
        let msg_type = buf.get_u16();
        let msg_len = buf.get_u32() as usize;

        if src.len() < 6 + msg_len {
            src.reserve(6 + msg_len - src.len());
            return Ok(None);
        }

        let _ = src.split_to(6);
        let bytes = src.split_to(msg_len).freeze();

        Ok(Some(RawControlPacket {
            id: msg_type,
            bytes,
        }))
    }
}

impl Encoder<RawControlPacket> for ControlCodec {
    type Error = ProtocolError;

    fn encode(&mut self, item: RawControlPacket, dst: &mut BytesMut) -> Result<()> {
        if item.bytes.len() > 0x7f_ffff {
            return Err(ProtocolError::MessageTooLarge(item.bytes.len()));
        }

        dst.reserve(6 + item.bytes.len());
        dst.put_u16(item.id);
        dst.put_u32(item.bytes.len() as u32);
        dst.extend_from_slice(&item.bytes);

        Ok(())
    }
}

/// Marker trait for clientbound messages
pub trait Clientbound: prost::Message + Default {}

/// Marker trait for serverbound messages
pub trait Serverbound: prost::Message + Default {}

// Implement marker traits for message types
impl Clientbound for msgs::Version {}
impl Clientbound for msgs::UdpTunnel {}
impl Clientbound for msgs::Ping {}
impl Clientbound for msgs::ServerSync {}
impl Clientbound for msgs::ChannelRemove {}
impl Clientbound for msgs::ChannelState {}
impl Clientbound for msgs::UserRemove {}
impl Clientbound for msgs::UserState {}
impl Clientbound for msgs::TextMessage {}
impl Clientbound for msgs::PermissionDenied {}
impl Clientbound for msgs::CodecVersion {}
impl Clientbound for msgs::ServerConfig {}
impl Clientbound for msgs::CryptSetup {}
impl Clientbound for msgs::WebRtc {}
impl Clientbound for msgs::IceCandidate {}

impl Serverbound for msgs::Version {}
impl Serverbound for msgs::UdpTunnel {}
impl Serverbound for msgs::Authenticate {}
impl Serverbound for msgs::Ping {}
impl Serverbound for msgs::TextMessage {}
impl Serverbound for msgs::VoiceTarget {}
impl Serverbound for msgs::TalkingState {}
impl Serverbound for msgs::WebRtc {}
impl Serverbound for msgs::IceCandidate {}

/// Convert RawControlPacket to typed message
impl<T: prost::Message + Default> TryFrom<RawControlPacket> for T {
    type Error = ProtocolError;

    fn try_from(raw: RawControlPacket) -> Result<Self> {
        T::decode(raw.bytes.as_ref()).map_err(|e| ProtocolError::DecodeError(e.to_string()))
    }
}

/// Convert typed message to RawControlPacket
pub trait IntoRawControlPacket {
    fn into_raw(self) -> RawControlPacket;
}

macro_rules! impl_into_raw {
    ($type:ty, $id:expr) => {
        impl IntoRawControlPacket for $type {
            fn into_raw(self) -> RawControlPacket {
                let mut bytes = Vec::new();
                self.encode(&mut bytes).expect("Failed to encode message");
                RawControlPacket {
                    id: $id,
                    bytes: Bytes::from(bytes),
                }
            }
        }
    };
}

impl_into_raw!(msgs::Version, 0);
impl_into_raw!(msgs::UdpTunnel, 1);
impl_into_raw!(msgs::Authenticate, 2);
impl_into_raw!(msgs::Ping, 3);
impl_into_raw!(msgs::ServerSync, 5);
impl_into_raw!(msgs::ChannelRemove, 6);
impl_into_raw!(msgs::ChannelState, 7);
impl_into_raw!(msgs::UserRemove, 8);
impl_into_raw!(msgs::UserState, 9);
impl_into_raw!(msgs::TextMessage, 11);
impl_into_raw!(msgs::PermissionDenied, 12);
impl_into_raw!(msgs::CodecVersion, 21);
impl_into_raw!(msgs::ServerConfig, 24);
impl_into_raw!(msgs::CryptSetup, 15);
impl_into_raw!(msgs::WebRtc, 30);
impl_into_raw!(msgs::IceCandidate, 31);
impl_into_raw!(msgs::TalkingState, 32);
