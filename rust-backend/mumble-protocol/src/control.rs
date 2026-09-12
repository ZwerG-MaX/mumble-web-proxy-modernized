//! Control message types and wrappers

use crate::msgs;
use crate::{Clientbound, IntoRawControlPacket, RawControlPacket, Serverbound};

/// Typed control packet wrapper
#[derive(Debug, Clone)]
pub enum ControlPacket<D> {
    Version(msgs::Version),
    UdpTunnel(Box<crate::voice::VoicePacket<D>>),
    Authenticate(msgs::Authenticate),
    Ping(msgs::Ping),
    ServerSync(msgs::ServerSync),
    ChannelRemove(msgs::ChannelRemove),
    ChannelState(msgs::ChannelState),
    UserRemove(msgs::UserRemove),
    UserState(msgs::UserState),
    TextMessage(msgs::TextMessage),
    PermissionDenied(msgs::PermissionDenied),
    CodecVersion(msgs::CodecVersion),
    ServerConfig(msgs::ServerConfig),
    CryptSetup(msgs::CryptSetup),
    WebRtc(msgs::WebRtc),
    IceCandidate(msgs::IceCandidate),
    TalkingState(msgs::TalkingState),
    Unknown(RawControlPacket),
}

impl<D> ControlPacket<D> {
    /// Try to convert from raw packet
    pub fn from_raw(raw: RawControlPacket) -> Result<Self, crate::ProtocolError> {
        use crate::MessageType;
        let msg_type = MessageType::try_from(raw.id)?;

        Ok(match msg_type {
            MessageType::Version => ControlPacket::Version(msgs::Version::decode(raw.bytes.as_ref())?),
            MessageType::UdpTunnel => {
                let tunnel = msgs::UdpTunnel::decode(raw.bytes.as_ref())?;
                let voice = crate::voice::VoicePacket::from_tunnel(&tunnel)?;
                ControlPacket::UdpTunnel(Box::new(voice))
            }
            MessageType::Authenticate => ControlPacket::Authenticate(msgs::Authenticate::decode(raw.bytes.as_ref())?),
            MessageType::Ping => ControlPacket::Ping(msgs::Ping::decode(raw.bytes.as_ref())?),
            MessageType::ServerSync => ControlPacket::ServerSync(msgs::ServerSync::decode(raw.bytes.as_ref())?),
            MessageType::ChannelRemove => ControlPacket::ChannelRemove(msgs::ChannelRemove::decode(raw.bytes.as_ref())?),
            MessageType::ChannelState => ControlPacket::ChannelState(msgs::ChannelState::decode(raw.bytes.as_ref())?),
            MessageType::UserRemove => ControlPacket::UserRemove(msgs::UserRemove::decode(raw.bytes.as_ref())?),
            MessageType::UserState => ControlPacket::UserState(msgs::UserState::decode(raw.bytes.as_ref())?),
            MessageType::TextMessage => ControlPacket::TextMessage(msgs::TextMessage::decode(raw.bytes.as_ref())?),
            MessageType::PermissionDenied => ControlPacket::PermissionDenied(msgs::PermissionDenied::decode(raw.bytes.as_ref())?),
            MessageType::CodecVersion => ControlPacket::CodecVersion(msgs::CodecVersion::decode(raw.bytes.as_ref())?),
            MessageType::ServerConfig => ControlPacket::ServerConfig(msgs::ServerConfig::decode(raw.bytes.as_ref())?),
            MessageType::CryptSetup => ControlPacket::CryptSetup(msgs::CryptSetup::decode(raw.bytes.as_ref())?),
            MessageType::WebRtc => ControlPacket::WebRtc(msgs::WebRtc::decode(raw.bytes.as_ref())?),
            MessageType::IceCandidate => ControlPacket::IceCandidate(msgs::IceCandidate::decode(raw.bytes.as_ref())?),
            MessageType::TalkingState => ControlPacket::TalkingState(msgs::TalkingState::decode(raw.bytes.as_ref())?),
            _ => ControlPacket::Unknown(raw),
        })
    }
}

impl<D: std::marker::PhantomData<()>> From<ControlPacket<D>> for RawControlPacket {
    fn from(packet: ControlPacket<D>) -> Self {
        match packet {
            ControlPacket::Version(m) => m.into_raw(),
            ControlPacket::Authenticate(m) => m.into_raw(),
            ControlPacket::Ping(m) => m.into_raw(),
            ControlPacket::ServerSync(m) => m.into_raw(),
            ControlPacket::ChannelRemove(m) => m.into_raw(),
            ControlPacket::ChannelState(m) => m.into_raw(),
            ControlPacket::UserRemove(m) => m.into_raw(),
            ControlPacket::UserState(m) => m.into_raw(),
            ControlPacket::TextMessage(m) => m.into_raw(),
            ControlPacket::PermissionDenied(m) => m.into_raw(),
            ControlPacket::CodecVersion(m) => m.into_raw(),
            ControlPacket::ServerConfig(m) => m.into_raw(),
            ControlPacket::CryptSetup(m) => m.into_raw(),
            ControlPacket::WebRtc(m) => m.into_raw(),
            ControlPacket::IceCandidate(m) => m.into_raw(),
            ControlPacket::TalkingState(m) => m.into_raw(),
            ControlPacket::Unknown(raw) => raw,
            ControlPacket::UdpTunnel(_) => {
                panic!("UdpTunnel should be handled separately")
            }
        }
    }
}

use prost::Message;
