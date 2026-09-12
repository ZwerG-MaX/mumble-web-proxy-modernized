import { useState } from 'react'
import CodeViewer from './components/CodeViewer'
import ChangesOverview from './components/ChangesOverview'
import FileExplorer from './components/FileExplorer'

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
    old: `// TODO For some reason, reconnecting without reloading the page and without disconnecting the
//      previous connection (i.e. multiple simultaneous connections) causes FF to reject our DTLS
//      cert. Works in Chrome, or in different tabs or when properly closing the old connection.
use argparse::StoreOption;
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
    ap.refer(&mut config.accept_invalid_certs).add_option(
        &["--accept-invalid-certificate"],
        StoreTrue,
        "Connect to upstream server even when its certificate is invalid.
                 Only ever use this if know that your server is using a self-signed certificate!",
    );
    ap.refer(&mut config.ice_min_port).add_option(
        &["--ice-port-min"],
        Store,
        "Minimum port number to use for ICE host candidates.",
    );
    ap.refer(&mut config.ice_max_port).add_option(
        &["--ice-port-max"],
        Store,
        "Maximum port number to use for ICE host candidates.",
    );
    ap.refer(&mut config.ice_public_v4).add_option(
        &["--ice-ipv4"],
        StoreOption,
        "Set a public IPv4 address to be used for ICE host candidates.",
    );
    ap.refer(&mut config.ice_public_v6).add_option(
        &["--ice-ipv6"],
        StoreOption,
        "Set a public IPv6 address to be used for ICE host candidates.",
    );
    ap
}

fn error_missing_arg(arg: &str) {
    let args: Vec<String> = std::env::args().collect();
    let name = if args.len() > 0 {
        &args[0][..]
    } else {
        "unknown"
    };
    let mut config = Config::default();
    let ap = create_argparser(&mut config);
    ap.error(
        name,
        &format!("Option [\\"--{}\\"] is required", arg),
        &mut std::io::stderr(),
    );
    std::process::exit(2);
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut config = Config::default();

    // First pass to get the config file path
    create_argparser(&mut config).parse_args_or_exit();
    if let Some(file) = config.file {
        // Then read in the config defaults
        config = toml::from_str(&std::fs::read_to_string(file)?)?;
        // Second pass to allow for overwrites
        create_argparser(&mut config).parse_args_or_exit();
    }

    if config.ws_port == 0 {
        error_missing_arg("listen-ws");
    }
    if config.upstream == "" {
        error_missing_arg("server");
    }

    let Config {
        ws_port,
        upstream,
        accept_invalid_certs,
        ..
    } = config.clone();

    // Try parsing as raw IPv6 address first
    let (upstream_host, upstream_port) = match upstream.parse::<Ipv6Addr>() {
        Ok(_) => (upstream.as_ref(), 64738),
        Err(_) => {
            // Otherwise split off port from end
            let mut upstream_parts = upstream.rsplitn(2, ':');
            let right = upstream_parts.next().expect("Empty upstream address");
            match upstream_parts.next() {
                Some(host) => (host, right.parse().expect("Failed to parse upstream port")),
                None => (right, 64738),
            }
        }
    };
    let upstream_host = Box::leak(Box::new(upstream_host.to_owned())).as_str();
    println!("Resolving upstream address {:?}", (upstream_host, upstream_port));
    let upstream_addr = (upstream_host, upstream_port)
        .to_socket_addrs()
        .expect("Failed to parse upstream address")
        .next()
        .expect("Failed to resolve upstream address");
    println!("Resolved upstream address: {}", upstream_addr);

    println!("Binding to port {}", ws_port);
    let ipv6_socket_addr = (Ipv6Addr::UNSPECIFIED, ws_port);
    let ipv4_socket_addr = (Ipv4Addr::UNSPECIFIED, ws_port);
    let socket_addrs = [SocketAddr::from(ipv6_socket_addr), SocketAddr::from(ipv4_socket_addr)];

    let server = TcpListener::bind(&socket_addrs[..]).await?;

    println!("Waiting for client connections..");
    loop {
        let (client, _) = server.accept().await?;
        let addr = match client.peer_addr() {
            Ok(addr) => addr,
            Err(err) => {
                if err.kind() != ErrorKind::NotConnected {
                    println!("Error getting address of new connection: {:?}", err);
                }
                continue;
            }
        };
        println!("New connection from {}", addr);

        // Connect to server
        let server = async move {
            let stream = TcpStream::connect(&upstream_addr).await?;
            let connector: TlsConnector = native_tls::TlsConnector::builder()
                .danger_accept_invalid_certs(accept_invalid_certs)
                .build()
                .unwrap()
                .into();
            let stream = connector.connect(upstream_host, stream).await?;
            Ok::<_, Error>(ClientControlCodec::new().framed(stream))
        };

        // Accept client
        let websocket_config = WebSocketConfig {
            max_send_queue: Some(10), // can be fairly small as voice is using WebRTC instead
            max_message_size: Some(0x7f_ffff), // maximum size accepted by Murmur
            max_frame_size: Some(0x7f_ffff), // maximum size accepted by Murmur
            accept_unmasked_frames: false, // browsers should comply with RFC 6455
        };
        fn header_callback(
            _req: &Request,
            mut response: Response,
        ) -> Result<Response, ErrorResponse> {
            response
                .headers_mut()
                .insert("Sec-WebSocket-Protocol", HeaderValue::from_static("binary"));
            Ok(response)
        }
        let client = accept_hdr_async_with_config(client, header_callback, Some(websocket_config))
            .err_into();

        // Once both are done, begin proxy duty
        let config = config.clone();
        tokio::spawn(async move {
            let (client, server) = future::try_join(client, server).await?;
            let (client_sink, client_stream) = client.split();
            let client_sink = client_sink.with(|m: ControlPacket<Clientbound>| {
                let m = RawControlPacket::from(m);
                let mut header = BytesMut::with_capacity(6);
                header.put_u16(m.id);
                header.put_u32(m.bytes.len() as u32);
                let mut buf = Vec::new();
                buf.extend(header);
                buf.extend(m.bytes);
                future::ready(Ok::<_, Error>(Message::Binary(buf)))
            });
            let client_stream = client_stream.err_into().try_filter_map(|m| {
                future::ok(match m {
                    Message::Binary(b) if b.len() >= 6 => {
                        let id = BigEndian::read_u16(&b);
                        // b[2..6] is length which is implicit in websocket msgs
                        let bytes = Bytes::from(b).slice(6..);
                        RawControlPacket { id, bytes }.try_into().ok()
                    }
                    _ => None,
                })
            });

            let (server_sink, server_stream) = server.split();
            let server_sink = server_sink.sink_err_into();
            let server_stream = server_stream.err_into();

            Connection::new(
                config,
                client_sink,
                client_stream,
                server_sink,
                server_stream,
            ).await?;

            println!("Client connection closed: {}", addr);

            Ok::<_, Error>(())
        }.unwrap_or_else(move |err| {
            if !err.is_connection_closed() {
                println!("Error on connection {}: {:?}", addr, err);
            }
        }));
    }
}`,
    new: `//! Mumble to WebSocket+WebRTC proxy
//!
//! This proxy bridges Mumble's TCP control and UDP voice protocols to WebSocket and WebRTC,
//! allowing browser-based clients to connect to vanilla Mumble servers.

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

    /// Hostname and port of the upstream Mumble server (e.g., "mumble.example.com:64738")
    #[arg(long, required = true)]
    pub server: String,

    /// Accept invalid TLS certificates (DANGEROUS: only for self-signed certs)
    #[arg(long, default_value = "false")]
    pub accept_invalid_certificate: bool,

    /// Minimum port for ICE host candidates
    #[arg(long, default_value = "1")]
    pub ice_port_min: u16,

    /// Maximum port for ICE host candidates
    #[arg(long, default_value = "65535")]
    pub ice_port_max: u16,

    /// Public IPv4 address for ICE host candidates (for NAT traversal)
    #[arg(long)]
    pub ice_ipv4: Option<Ipv4Addr>,

    /// Public IPv6 address for ICE host candidates (for NAT traversal)
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

fn parse_upstream_address(upstream: &str) -> Result<(String, u16)> {
    // Try parsing as raw IPv6 address
    if let Ok(_) = upstream.parse::<Ipv6Addr>() {
        return Ok((upstream.to_string(), 64738));
    }

    // Split host and port
    let parts: Vec<&str> = upstream.rsplitn(2, ':').collect();
    match parts.len() {
        2 => {
            let port = parts[0].parse::<u16>().context("Invalid upstream port")?;
            let host = parts[1].to_string();
            Ok((host, port))
        }
        1 => Ok((parts[0].to_string(), 64738)),
        _ => anyhow::bail!("Invalid upstream address format"),
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
            .with_context(|| format!("Failed to read config file: {:?}", config_path))?;
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
    info!(host = %upstream_host, port = upstream_port, "Resolving upstream address");

    let upstream_addr = (upstream_host.as_str(), upstream_port)
        .to_socket_addrs()
        .context("Failed to parse upstream address")?
        .next()
        .context("Failed to resolve upstream address")?;
    info!(addr = %upstream_addr, "Resolved upstream address");

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
            if let Err(err) = handle_client(client_stream, addr, config, upstream_host, upstream_addr).await {
                if !err.is_connection_closed() {
                    error!(client = %addr, error = %err, "Connection error");
                } else {
                    info!(client = %addr, "Client disconnected");
                }
            }
        });
    }
}

async fn handle_client(
    client_stream: TcpStream,
    addr: SocketAddr,
    config: Arc<Config>,
    upstream_host: String,
    upstream_addr: SocketAddr,
) -> Result<(), Error> {
    // Connect to upstream Mumble server
    let server_future = async move {
        let stream = TcpStream::connect(&upstream_addr).await?;
        
        let tls_config = rustls::ClientConfig::builder()
            .with_root_certificates(rustls::RootCertStore::empty())
            .with_no_client_auth();
        
        let connector = TlsConnector::from(Arc::new(tls_config));
        let domain = rustls::pki_types::ServerName::try_from(upstream_host.clone())
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidInput, e))?;
        
        let tls_stream = connector.connect(domain, stream).await?;
        Ok::<_, Error>(ClientControlCodec::new().framed(tls_stream))
    };

    // Accept WebSocket client
    let ws_config = WebSocketConfig {
        max_send_queue: Some(10),
        max_message_size: Some(0x7f_ffff),
        max_frame_size: Some(0x7f_ffff),
        accept_unmasked_frames: false,
        ..Default::default()
    };

    let client_future = async {
        let callback = |req: &Request, mut response: Response| {
            response.headers_mut().insert(
                "Sec-WebSocket-Protocol",
                HeaderValue::from_static("binary"),
            );
            Ok(response)
        };
        accept_hdr_async_with_config(client_stream, callback, Some(ws_config)).await
    };

    let (client_ws, server_codec) = future::try_join(client_future, server_future).await?;

    let (client_sink, client_stream) = client_ws.split();
    
    // Transform client sink to send ControlPackets as binary WebSocket messages
    let client_sink = client_sink.with(|msg: ControlPacket<Clientbound>| {
        let raw = RawControlPacket::from(msg);
        let mut header = BytesMut::with_capacity(6);
        header.put_u16(raw.id);
        header.put_u32(raw.bytes.len() as u32);
        let mut buf = Vec::with_capacity(6 + raw.bytes.len());
        buf.extend_from_slice(&header);
        buf.extend_from_slice(&raw.bytes);
        future::ready(Ok::<_, Error>(Message::Binary(buf)))
    });

    // Transform client stream to receive ControlPackets from binary WebSocket messages
    let client_stream = client_stream.err_into().try_filter_map(|msg| {
        future::ok(match msg {
            Message::Binary(data) if data.len() >= 6 => {
                let id = BigEndian::read_u16(&data);
                let bytes = Bytes::from(data).slice(6..);
                RawControlPacket { id, bytes }.try_into().ok()
            }
            _ => None,
        })
    });

    let (server_sink, server_stream) = server_codec.split();

    // Start proxying
    Connection::new(
        config,
        client_sink,
        client_stream,
        server_sink.err_into(),
        server_stream.err_into(),
    )
    .await?;

    info!(client = %addr, "Connection closed");
    Ok(())
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
        matches!(self, Error::ConnectionClosed | Error::WebSocket(tungstenite::Error::ConnectionClosed))
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
use mumble_protocol::Clientbound;
use mumble_protocol::Serverbound;
use openssl::asn1::Asn1Time;
use openssl::hash::MessageDigest;
use openssl::pkey::{PKey, Private};
use openssl::rsa::Rsa;
use openssl::ssl::{SslAcceptor, SslAcceptorBuilder, SslMethod};
use openssl::x509::X509;
use rtp::rfc3550::{
    RtcpCompoundPacket, RtcpPacket, RtcpPacketReader, RtcpPacketWriter, RtpFixedHeader, RtpPacket,
    RtpPacketReader, RtpPacketWriter,
};
use rtp::rfc5761::{MuxPacketReader, MuxPacketWriter, MuxedPacket};
use rtp::rfc5764::DtlsSrtp;
use rtp::traits::{ReadPacket, WritePacket};
use std::collections::{BTreeMap, VecDeque};
use std::ffi::CString;
use std::net::IpAddr;
use std::pin::Pin;
use std::task::Context;
use std::task::Poll;
use std::time::Duration;
use tokio::io;
use tokio::time::Sleep;
use webrtc_sdp::attribute_type::SdpAttribute;

use crate::error::Error;
use crate::Config;

type SessionId = u32;

struct User {
    session: u32,                     // mumble session id
    ssrc: u32,                        // ssrc id
    active: bool,                     // whether the user is currently transmitting audio
    timeout: Option<Pin<Box<Sleep>>>, // assume end of transmission if silent until then
    start_voice_seq_num: u64,
    highest_voice_seq_num: u64,
    rtp_seq_num_offset: u32, // u32 because we also derive the timestamp from it
}

impl User {
    fn set_inactive(&mut self) -> Option<Frame> {
        self.timeout = None;

        if self.active {
            self.active = false;

            self.rtp_seq_num_offset = self
                .rtp_seq_num_offset
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

pub struct Connection {
    config: Config,
    inbound_client: Pin<Box<dyn Stream<Item = Result<ControlPacket<Serverbound>, Error>> + Send>>,
    outbound_client: Pin<Box<dyn Sink<ControlPacket<Clientbound>, Error = Error> + Send>>,
    inbound_server: Pin<Box<dyn Stream<Item = Result<ControlPacket<Clientbound>, Error>> + Send>>,
    outbound_server: Pin<Box<dyn Sink<ControlPacket<Serverbound>, Error = Error> + Send>>,
    outbound_buf: VecDeque<Frame>,

    ice: Option<(ice::Agent, ice::Stream)>,
    candidate_gathering_done: bool,

    dtls_srtp_future: Option<
        BoxFuture<'static, Result<DtlsSrtp<ice::StreamComponent, SslAcceptorBuilder>, io::Error>>,
    >,
    dtls_srtp: Option<DtlsSrtp<ice::StreamComponent, SslAcceptorBuilder>>,
    dtls_key: PKey<Private>,
    dtls_cert: X509,

    rtp_reader: MuxPacketReader<RtpPacketReader, RtcpPacketReader>,
    rtp_writer: MuxPacketWriter<RtpPacketWriter, RtcpPacketWriter>,

    target: Option<u8>, // only if client is talking
    next_ssrc: u32,
    free_ssrcs: Vec<u32>,
    sessions: BTreeMap<SessionId, User>,
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
        CSt: Stream<Item = Result<ControlPacket<Serverbound>, Error>> + 'static + Send,
        SSi: Sink<ControlPacket<Serverbound>, Error = Error> + 'static + Send,
        SSt: Stream<Item = Result<ControlPacket<Clientbound>, Error>> + 'static + Send,
    {
        let rsa = Rsa::generate(2048).unwrap();
        let key = PKey::from_rsa(rsa).unwrap();

        let mut cert_builder = X509::builder().unwrap();
        cert_builder
            .set_not_after(&Asn1Time::days_from_now(1).unwrap())
            .unwrap();
        cert_builder
            .set_not_before(&Asn1Time::days_from_now(0).unwrap())
            .unwrap();
        cert_builder.set_pubkey(&key).unwrap();
        cert_builder.sign(&key, MessageDigest::sha256()).unwrap();
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

    fn supports_webrtc(&self) -> bool {
        self.ice.is_some()
    }

    fn allocate_ssrc(&mut self, session_id: SessionId) -> &mut User {
        let ssrc = self.free_ssrcs.pop().unwrap_or_else(|| {
            let ssrc = self.next_ssrc;
            self.next_ssrc += 1;
            if let Some(ref mut dtls_srtp) = self.dtls_srtp {
                dtls_srtp.add_incoming_unknown_ssrcs(1);
                dtls_srtp.add_outgoing_unknown_ssrcs(1);
            }
            ssrc
        });
        let user = User {
            session: session_id,
            ssrc,
            active: false,
            timeout: None,
            start_voice_seq_num: 0,
            highest_voice_seq_num: 0,
            rtp_seq_num_offset: 0,
        };
        self.sessions.insert(session_id, user);
        self.sessions.get_mut(&session_id).unwrap()
    }

    fn free_ssrc(&mut self, session_id: SessionId) {
        if let Some(user) = self.sessions.remove(&session_id) {
            self.free_ssrcs.push(user.ssrc)
        }
    }

    fn setup_ice(&mut self) -> Result<(), Error> {
        // Setup ICE agent
        let mut agent = ice::Agent::new_rfc5245();
        agent.set_software("mumble-web-proxy");
        agent.set_controlling_mode(true);

        // Setup ICE stream
        let mut stream = match {
            let mut builder = agent.stream_builder(1);
            if self.config.ice_min_port != 1 || self.config.ice_max_port != u16::max_value() {
                builder.set_port_range(self.config.ice_min_port, self.config.ice_max_port);
            }
            builder.build()
        } {
            Ok(stream) => stream,
            Err(err) => {
                return Err(io::Error::new(io::ErrorKind::Other, err).into());
            }
        };
        let component = stream.take_components().pop().expect("one component");

        // Send WebRTC details to the client
        let mut msg = msgs::WebRTC::new();
        msg.set_dtls_fingerprint(
            self.dtls_cert
                .digest(MessageDigest::sha256())
                .unwrap()
                .iter()
                .map(|byte| format!("{:02X}", byte))
                .collect::<Vec<_>>()
                .join(":"),
        );
        msg.set_ice_pwd(stream.get_local_pwd().to_owned());
        msg.set_ice_ufrag(stream.get_local_ufrag().to_owned());

        // Store ice agent and stream for later use
        self.ice = Some((agent, stream));

        // Prepare to accept the DTLS connection
        let mut acceptor = SslAcceptor::mozilla_intermediate(SslMethod::dtls()).unwrap();
        acceptor.set_certificate(&self.dtls_cert).unwrap();
        acceptor.set_private_key(&self.dtls_key).unwrap();
        // FIXME: verify remote fingerprint
        self.dtls_srtp_future = Some(DtlsSrtp::handshake(component, acceptor).boxed());

        self.outbound_buf.push_back(Frame::Client(msg.into()));
        Ok(())
    }

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
                println!("Local ice candidate: {}", candidate.to_string());

                // Map to public addresses (if configured)
                let config = &self.config;
                match (
                    &mut candidate.address,
                    config.ice_public_v4,
                    config.ice_public_v6,
                ) {
                    (webrtc_sdp::address::Address::Ip(IpAddr::V4(addr)), Some(public), _) => {
                        *addr = public;
                    }
                    (webrtc_sdp::address::Address::Ip(IpAddr::V6(addr)), _, Some(public)) => {
                        *addr = public;
                    }
                    _ => {} // non configured
                };

                // Got a new candidate, send it to the client
                let mut msg = msgs::IceCandidate::new();
                msg.set_content(format!("candidate:{}", candidate.to_string()));
                let frame = Frame::Client(msg.into());
                self.outbound_buf.push_back(frame);
                true
            }
            Poll::Ready(None) => {
                self.candidate_gathering_done = true;
                false
            }
            _ => false,
        }
    }

    fn dispatch_outbound_frames(
        mut self: Pin<&mut Self>,
        cx: &mut Context,
    ) -> Poll<Result<(), Error>> {
        // Make sure we can send any pending frames before trying to do so
        ready!(self.outbound_server.as_mut().poll_ready(cx)?);
        ready!(self.outbound_client.as_mut().poll_ready(cx)?);
        if let Some(ref mut dtls_srtp) = self.dtls_srtp {
            ready!(Pin::new(dtls_srtp).poll_ready(cx)?);
        }

        // Send out all pending frames
        while let Some(frame) = self.outbound_buf.pop_front() {
            match frame {
                Frame::Server(frame) => {
                    self.outbound_server.as_mut().start_send(frame)?;
                    ready!(self.outbound_server.as_mut().poll_ready(cx)?);
                }
                Frame::Client(frame) => {
                    self.outbound_client.as_mut().start_send(frame)?;
                    ready!(self.outbound_client.as_mut().poll_ready(cx)?);
                }
                Frame::Rtp(frame) => {
                    let mut buf = Vec::new();
                    self.rtp_writer.write_packet(&mut buf, &frame)?;
                    if let Some(ref mut dtls_srtp) = self.dtls_srtp {
                        pin_mut!(dtls_srtp);
                        dtls_srtp.as_mut().start_send(&buf)?;
                        ready!(dtls_srtp.poll_ready(cx)?);
                    } else {
                        // RTP not yet setup, just drop the frame
                    }
                }
            }
        }

        // All frames have been sent (or queued), flush any buffers in the output path
        let _ = self.outbound_client.as_mut().poll_flush(cx)?;
        let _ = self.outbound_server.as_mut().poll_flush(cx)?;
        if let Some(ref mut dtls_srtp) = self.dtls_srtp {
            let _ = Pin::new(dtls_srtp).poll_flush(cx)?;
        }

        Poll::Ready(Ok(()))
    }

    fn handle_voice_packet(&mut self, packet: VoicePacket<Clientbound>) -> Result<(), Error> {
        let (target, session_id, seq_num, opus_data, last_bit) = match packet {
            VoicePacket::Audio {
                target,
                session_id,
                seq_num,
                payload: VoicePacketPayload::Opus(data, last_bit),
                ..
            } => (target, session_id, seq_num, data, last_bit),
            _ => return Ok(()),
        };

        let user = match self.sessions.get_mut(&(session_id as u32)) {
            Some(s) => s,
            None => return Ok(()),
        };
        let rtp_ssrc = user.ssrc;

        let mut first_in_transmission = if user.active {
            false
        } else {
            user.start_voice_seq_num = seq_num;
            user.highest_voice_seq_num = seq_num;
            true
        };

        let offset = seq_num - user.start_voice_seq_num;
        let mut rtp_seq_num = user.rtp_seq_num_offset + offset as u32;

        if last_bit {
            if seq_num <= user.highest_voice_seq_num {
                return Ok(());
            }
            if let Some(frame) = user.set_inactive() {
                self.outbound_buf.push_back(frame);
            }
        } else if seq_num == user.highest_voice_seq_num && seq_num != user.start_voice_seq_num {
            return Ok(());
        } else if seq_num >= user.highest_voice_seq_num
            && seq_num < user.highest_voice_seq_num + 100
        {
            user.highest_voice_seq_num = seq_num;
            if let Some(frame) = user.set_active(target) {
                self.outbound_buf.push_back(frame);
            }
        } else if seq_num < user.highest_voice_seq_num && seq_num + 100 > user.highest_voice_seq_num
        {
            if let Some(frame) = user.set_active(target) {
                self.outbound_buf.push_back(frame);
            }
        } else {
            if let Some(frame) = user.set_inactive() {
                self.outbound_buf.push_back(frame);
            }
            first_in_transmission = true;
            user.start_voice_seq_num = seq_num;
            user.highest_voice_seq_num = seq_num;
            rtp_seq_num = user.rtp_seq_num_offset;
            if let Some(frame) = user.set_active(target) {
                self.outbound_buf.push_back(frame);
            }
        };

        let rtp_time = 480 * rtp_seq_num;

        let rtp = RtpPacket {
            header: RtpFixedHeader {
                padding: false,
                marker: first_in_transmission,
                payload_type: 97,
                seq_num: rtp_seq_num as u16,
                timestamp: rtp_time as u32,
                ssrc: rtp_ssrc,
                csrc_list: Vec::new(),
                extension: None,
            },
            payload: opus_data.to_vec(),
            padding: Vec::new(),
        };
        let frame = Frame::Rtp(MuxedPacket::Rtp(rtp));
        self.outbound_buf.push_back(frame);

        Ok(())
    }

    fn process_packet_from_server(
        &mut self,
        packet: ControlPacket<Clientbound>,
    ) -> Result<(), Error> {
        if !self.supports_webrtc() {
            self.outbound_buf.push_back(Frame::Client(packet));
            return Ok(());
        }
        match packet {
            ControlPacket::UDPTunnel(voice) => return self.handle_voice_packet(*voice),
            ControlPacket::UserState(mut message) => {
                let session_id = message.get_session();
                if !self.sessions.contains_key(&session_id) {
                    let user = self.allocate_ssrc(session_id);
                    message.set_ssrc(user.ssrc);
                }
                self.outbound_buf
                    .push_back(Frame::Client((*message).into()));
            }
            ControlPacket::UserRemove(message) => {
                self.free_ssrc(message.get_session());
                self.outbound_buf
                    .push_back(Frame::Client((*message).into()));
            }
            other => self.outbound_buf.push_back(Frame::Client(other)),
        };
        Ok(())
    }

    fn process_packet_from_client(
        &mut self,
        packet: ControlPacket<Serverbound>,
    ) -> Result<(), Error> {
        match packet {
            ControlPacket::Authenticate(mut message) => {
                println!("MSG Authenticate: {:?}", {
                    let mut message = message.clone();
                    if message.get_password() != "" {
                        message.set_password("{{snip}}".to_string());
                    }
                    message
                });
                if message.get_webrtc() {
                    message.clear_webrtc();
                    message.set_opus(true);
                    self.outbound_buf
                        .push_back(Frame::Server((*message).into()));

                    self.setup_ice()?;
                } else {
                    self.outbound_buf
                        .push_back(Frame::Server((*message).into()));
                }
            }
            ControlPacket::WebRTC(mut message) => {
                println!("Got WebRTC: {:?}", message);
                if let Some((_, stream)) = &mut self.ice {
                    if let (Ok(ufrag), Ok(pwd)) = (
                        CString::new(message.take_ice_ufrag()),
                        CString::new(message.take_ice_pwd()),
                    ) {
                        stream.set_remote_credentials(ufrag, pwd);
                    }
                }
            }
            ControlPacket::IceCandidate(mut message) => {
                let candidate = message.take_content();
                println!("Got ice candidate: {:?}", candidate);
                if let Some((_, stream)) = &mut self.ice {
                    match format!("candidate:{}", candidate).parse() {
                        Ok(SdpAttribute::Candidate(candidate)) => {
                            stream.add_remote_candidate(candidate)
                        }
                        Ok(_) => unreachable!(),
                        Err(err) => {
                            return Err(io::Error::new(
                                io::ErrorKind::Other,
                                format!("Error parsing ICE candidate: {}", err),
                            )
                            .into());
                        }
                    }
                }
            }
            ControlPacket::TalkingState(message) => {
                self.target = if message.has_target() {
                    Some(message.get_target() as u8)
                } else {
                    None
                };
            }
            other => {
                self.outbound_buf.push_back(Frame::Server(other));
            }
        };
        Ok(())
    }

    fn process_rtp_packet(&mut self, buf: &[u8]) {
        match self.rtp_reader.read_packet(&mut &buf[..]) {
            Ok(MuxedPacket::Rtp(rtp)) => {
                if let Some(target) = self.target {
                    let seq_num = rtp.header.timestamp / 480;

                    let voice_packet = VoicePacket::Audio {
                        _dst: std::marker::PhantomData::<Serverbound>,
                        target,
                        session_id: (),
                        seq_num: seq_num.into(),
                        payload: VoicePacketPayload::Opus(rtp.payload.into(), false),
                        position_info: None,
                    };

                    self.outbound_buf
                        .push_back(Frame::Server(voice_packet.into()));
                }
            }
            Ok(MuxedPacket::Rtcp(_rtcp)) => {}
            Err(_err) => {}
        }
    }
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

                    println!("DTLS-SRTP connection established.");

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

#[derive(Clone)]
enum Frame {
    Server(ControlPacket<Serverbound>),
    Client(ControlPacket<Clientbound>),
    Rtp(MuxedPacket<RtpPacket, RtcpCompoundPacket<RtcpPacket>>),
}`,
    new: `//! Connection handler for Mumble-WebRTC proxy
//!
//! This module manages the bidirectional proxy between a WebSocket client and a Mumble server,
//! handling ICE/WebRTC setup, DTLS-SRTP negotiation, and voice packet transcoding.

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
    RtcpCompoundPacket, RtcpPacket, RtcpPacketReader, RtcpPacketWriter, RtpFixedHeader, RtpPacket,
    RtpPacketReader, RtpPacketWriter,
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
            self.rtp_seq_num_offset = self
                .rtp_seq_num_offset
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

    /// Check if WebRTC is supported for this connection
    fn supports_webrtc(&self) -> bool {
        self.ice.is_some()
    }

    /// Allocate a new SSRC for a user session
    fn allocate_ssrc(&mut self, session_id: SessionId) -> &mut User {
        let ssrc = self.free_ssrcs.pop().unwrap_or_else(|| {
            let ssrc = self.next_ssrc;
            self.next_ssrc += 1;
            if let Some(ref mut dtls_srtp) = self.dtls_srtp {
                dtls_srtp.add_incoming_unknown_ssrcs(1);
                dtls_srtp.add_outgoing_unknown_ssrcs(1);
            }
            ssrc
        });

        let user = User {
            session: session_id,
            ssrc,
            active: false,
            timeout: None,
            start_voice_seq_num: 0,
            highest_voice_seq_num: 0,
            rtp_seq_num_offset: 0,
        };

        self.sessions.insert(session_id, user);
        self.sessions.get_mut(&session_id).unwrap()
    }

    /// Free SSRC when user disconnects
    fn free_ssrc(&mut self, session_id: SessionId) {
        if let Some(user) = self.sessions.remove(&session_id) {
            self.free_ssrcs.push(user.ssrc);
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
                match (
                    &mut candidate.address,
                    self.config.ice_ipv4,
                    self.config.ice_ipv6,
                ) {
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

    /// Dispatch queued outbound frames
    fn dispatch_outbound_frames(
        mut self: Pin<&mut Self>,
        cx: &mut Context,
    ) -> Poll<Result<(), Error>> {
        ready!(self.outbound_server.as_mut().poll_ready(cx)?);
        ready!(self.outbound_client.as_mut().poll_ready(cx)?);
        if let Some(ref mut dtls_srtp) = self.dtls_srtp {
            ready!(Pin::new(dtls_srtp).poll_ready(cx)?);
        }

        while let Some(frame) = self.outbound_buf.pop_front() {
            match frame {
                Frame::Server(frame) => {
                    self.outbound_server.as_mut().start_send(frame)?;
                    ready!(self.outbound_server.as_mut().poll_ready(cx)?);
                }
                Frame::Client(frame) => {
                    self.outbound_client.as_mut().start_send(frame)?;
                    ready!(self.outbound_client.as_mut().poll_ready(cx)?);
                }
                Frame::Rtp(frame) => {
                    let mut buf = Vec::new();
                    self.rtp_writer.write_packet(&mut buf, &frame)?;
                    if let Some(ref mut dtls_srtp) = self.dtls_srtp {
                        pin_mut!(dtls_srtp);
                        dtls_srtp.as_mut().start_send(&buf)?;
                        ready!(dtls_srtp.poll_ready(cx)?);
                    }
                }
            }
        }

        let _ = self.outbound_client.as_mut().poll_flush(cx)?;
        let _ = self.outbound_server.as_mut().poll_flush(cx)?;
        if let Some(ref mut dtls_srtp) = self.dtls_srtp {
            let _ = Pin::new(dtls_srtp).poll_flush(cx)?;
        }

        Poll::Ready(Ok(()))
    }

    /// Handle incoming voice packet from Mumble server
    fn handle_voice_packet(&mut self, packet: VoicePacket<Clientbound>) -> Result<(), Error> {
        let (target, session_id, seq_num, opus_data, last_bit) = match packet {
            VoicePacket::Audio {
                target,
                session_id,
                seq_num,
                payload: VoicePacketPayload::Opus(data, last_bit),
                ..
            } => (target, session_id, seq_num, data, last_bit),
            _ => return Ok(()),
        };

        let user = match self.sessions.get_mut(&(session_id as u32)) {
            Some(s) => s,
            None => return Ok(()),
        };

        let rtp_ssrc = user.ssrc;
        let mut first_in_transmission = if user.active {
            false
        } else {
            user.start_voice_seq_num = seq_num;
            user.highest_voice_seq_num = seq_num;
            true
        };

        let offset = seq_num - user.start_voice_seq_num;
        let mut rtp_seq_num = user.rtp_seq_num_offset + offset as u32;

        if last_bit {
            if seq_num <= user.highest_voice_seq_num {
                return Ok(());
            }
            if let Some(frame) = user.set_inactive() {
                self.outbound_buf.push_back(frame);
            }
        } else if seq_num == user.highest_voice_seq_num && seq_num != user.start_voice_seq_num {
            return Ok(());
        } else if seq_num >= user.highest_voice_seq_num && seq_num < user.highest_voice_seq_num + 100 {
            user.highest_voice_seq_num = seq_num;
            if let Some(frame) = user.set_active(target) {
                self.outbound_buf.push_back(frame);
            }
        } else if seq_num < user.highest_voice_seq_num && seq_num + 100 > user.highest_voice_seq_num {
            if let Some(frame) = user.set_active(target) {
                self.outbound_buf.push_back(frame);
            }
        } else {
            if let Some(frame) = user.set_inactive() {
                self.outbound_buf.push_back(frame);
            }
            first_in_transmission = true;
            user.start_voice_seq_num = seq_num;
            user.highest_voice_seq_num = seq_num;
            rtp_seq_num = user.rtp_seq_num_offset;
            if let Some(frame) = user.set_active(target) {
                self.outbound_buf.push_back(frame);
            }
        }

        let rtp_time = 480 * rtp_seq_num;
        let rtp = RtpPacket {
            header: RtpFixedHeader {
                padding: false,
                marker: first_in_transmission,
                payload_type: 97,
                seq_num: rtp_seq_num as u16,
                timestamp: rtp_time as u32,
                ssrc: rtp_ssrc,
                csrc_list: Vec::new(),
                extension: None,
            },
            payload: opus_data.to_vec(),
            padding: Vec::new(),
        };

        self.outbound_buf.push_back(Frame::Rtp(MuxedPacket::Rtp(rtp)));
        Ok(())
    }

    /// Process packet received from Mumble server
    fn process_packet_from_server(&mut self, packet: ControlPacket<Clientbound>) -> Result<(), Error> {
        if !self.supports_webrtc() {
            self.outbound_buf.push_back(Frame::Client(packet));
            return Ok(());
        }

        match packet {
            ControlPacket::UDPTunnel(voice) => self.handle_voice_packet(*voice),
            ControlPacket::UserState(mut message) => {
                let session_id = message.get_session();
                if !self.sessions.contains_key(&session_id) {
                    let user = self.allocate_ssrc(session_id);
                    message.set_ssrc(user.ssrc);
                }
                self.outbound_buf.push_back(Frame::Client((*message).into()));
                Ok(())
            }
            ControlPacket::UserRemove(message) => {
                self.free_ssrc(message.get_session());
                self.outbound_buf.push_back(Frame::Client((*message).into()));
                Ok(())
            }
            other => {
                self.outbound_buf.push_back(Frame::Client(other));
                Ok(())
            }
        }
    }

    /// Process packet received from WebSocket client
    fn process_packet_from_client(&mut self, packet: ControlPacket<Serverbound>) -> Result<(), Error> {
        match packet {
            ControlPacket::Authenticate(mut message) => {
                debug!(
                    webrtc = message.get_webrtc(),
                    "Received Authenticate message"
                );

                if message.get_webrtc() {
                    message.clear_webrtc();
                    message.set_opus(true);
                    self.outbound_buf.push_back(Frame::Server((*message).into()));
                    self.setup_ice()?;
                } else {
                    self.outbound_buf.push_back(Frame::Server((*message).into()));
                }
                Ok(())
            }
            ControlPacket::WebRTC(mut message) => {
                debug!("Received WebRTC message");
                if let Some((_, stream)) = &mut self.ice {
                    if let (Ok(ufrag), Ok(pwd)) = (
                        CString::new(message.take_ice_ufrag()),
                        CString::new(message.take_ice_pwd()),
                    ) {
                        stream.set_remote_credentials(ufrag, pwd);
                    }
                }
                Ok(())
            }
            ControlPacket::IceCandidate(mut message) => {
                let candidate = message.take_content();
                trace!(candidate = %candidate, "Received ICE candidate");

                if let Some((_, stream)) = &mut self.ice {
                    match format!("candidate:{}", candidate).parse() {
                        Ok(SdpAttribute::Candidate(candidate)) => {
                            stream.add_remote_candidate(candidate);
                        }
                        Ok(_) => unreachable!(),
                        Err(err) => {
                            return Err(Error::Ice(format!("Failed to parse ICE candidate: {}", err)));
                        }
                    }
                }
                Ok(())
            }
            ControlPacket::TalkingState(message) => {
                self.target = if message.has_target() {
                    Some(message.get_target() as u8)
                } else {
                    None
                };
                Ok(())
            }
            other => {
                self.outbound_buf.push_back(Frame::Server(other));
                Ok(())
            }
        }
    }

    /// Process incoming RTP packet from WebRTC client
    fn process_rtp_packet(&mut self, buf: &[u8]) {
        match self.rtp_reader.read_packet(&mut &buf[..]) {
            Ok(MuxedPacket::Rtp(rtp)) => {
                if let Some(target) = self.target {
                    let seq_num = rtp.header.timestamp / 480;
                    let voice_packet = VoicePacket::Audio {
                        _dst: std::marker::PhantomData::<Serverbound>,
                        target,
                        session_id: (),
                        seq_num: seq_num.into(),
                        payload: VoicePacketPayload::Opus(rtp.payload.into(), false),
                        position_info: None,
                    };
                    self.outbound_buf.push_back(Frame::Server(voice_packet.into()));
                }
            }
            Ok(MuxedPacket::Rtcp(_)) => {}
            Err(err) => {
                warn!(error = %err, "Failed to parse RTP packet");
            }
        }
    }
}

impl Future for Connection {
    type Output = Result<(), Error>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context) -> Poll<Result<(), Error>> {
        'poll: loop {
            // Poll ICE agent
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

            // Gather ICE candidates
            if self.as_mut().gather_ice_candidates(cx) {
                continue 'poll;
            }

            // Poll DTLS-SRTP handshake
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

            // Poll server stream
            match self.inbound_server.as_mut().poll_next(cx)? {
                Poll::Pending => {}
                Poll::Ready(Some(frame)) => {
                    self.process_packet_from_server(frame)?;
                    continue 'poll;
                }
                Poll::Ready(None) => return Poll::Ready(Ok(())),
            }

            // Poll client stream
            match self.inbound_client.as_mut().poll_next(cx)? {
                Poll::Pending => {}
                Poll::Ready(Some(frame)) => {
                    self.process_packet_from_client(frame)?;
                    continue 'poll;
                }
                Poll::Ready(None) => return Poll::Ready(Ok(())),
            }

            // Poll DTLS-SRTP stream
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

export default function App() {
  const [selectedFile, setSelectedFile] = useState<keyof typeof files>('Cargo.toml')
  const [viewMode, setViewMode] = useState<'split' | 'old' | 'new'>('split')

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <i className="fas fa-code text-white"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold">mumble-web-proxy</h1>
                <p className="text-xs text-gray-400">Modernized Code Review</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/Johni0702/mumble-web-proxy"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                <i className="fab fa-github mr-2"></i>
                Original Repo
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview */}
        <ChangesOverview />

        {/* File Explorer */}
        <FileExplorer
          files={Object.keys(files) as Array<keyof typeof files>}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
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
      </div>
    </div>
  )
}
