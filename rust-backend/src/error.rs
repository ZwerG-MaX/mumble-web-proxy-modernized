//! Error types for mumble-web-proxy

#![allow(unused_imports)]

use thiserror::Error;

/// Main error type for the proxy
#[derive(Error, Debug)]
pub enum Error {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("TLS error: {0}")]
    Tls(#[from] native_tls::Error),

    #[error("WebSocket error: {0}")]
    WebSocket(#[from] tungstenite::Error),

    #[error("Configuration error: {0}")]
    Config(#[from] toml::de::Error),

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
            Error::ConnectionClosed | Error::WebSocket(tungstenite::Error::ConnectionClosed)
        )
    }
}

impl From<anyhow::Error> for Error {
    fn from(err: anyhow::Error) -> Self {
        Error::Protocol(err.to_string())
    }
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, Error>;
