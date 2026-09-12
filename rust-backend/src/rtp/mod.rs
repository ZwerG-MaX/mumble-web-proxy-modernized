//! RTP (Real-time Transport Protocol) implementation
//!
//! This module provides a modern Rust implementation of RTP and related protocols:
//! - RFC 3550: RTP
//! - RFC 3711: SRTP
//! - RFC 5761: RTP/RTCP multiplexing
//! - RFC 5764: DTLS-SRTP

pub mod rfc3550;
pub mod rfc5761;
pub mod rfc5764;
pub mod traits;

use thiserror::Error;

/// Error type for RTP operations
#[derive(Error, Debug)]
pub enum Error {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid packet: {0}")]
    InvalidPacket(String),

    #[error("Buffer too small")]
    BufferTooSmall,

    #[error("TLS error: {0}")]
    Tls(String),

    #[error("SRTP error: {0}")]
    Srtp(String),
}

pub type Result<T> = std::result::Result<T, Error>;
