//! Mumble to WebSocket+WebRTC proxy
//!
//! This proxy bridges Mumble's TCP control and UDP voice protocols to WebSocket and WebRTC,
//! allowing browser-based clients to connect to vanilla Mumble servers.

#![allow(unused_imports, unused_variables)]

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
use tokio::net::{TcpListener, TcpStream};
use tokio_native_tls::TlsConnector;
use tokio_tungstenite::accept_hdr_async_with_config;
use tokio_util::codec::Decoder;
use tracing::{error, info};
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

    /// Hostname and port of the upstream Mumble server
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

#[derive(Debug, Clone, serde::Deserialize)]
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
    if upstream.parse::<Ipv6Addr>().is_ok() {
        return Ok((upstream.to_string(), 64738));
    }

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

    let args = CliArgs::parse();

    let mut config = if let Some(config_path) = &args.config {
        let content = std::fs::read_to_string(config_path)
            .with_context(|| format!("Failed to read config file: {:?}", config_path))?;
        toml::from_str(&content).context("Failed to parse config file")?
    } else {
        Config::default()
    };

    config.merge_with_cli(&args);

    if config.listen_ws == 0 {
        anyhow::bail!("--listen-ws is required");
    }
    if config.server.is_empty() {
        anyhow::bail!("--server is required");
    }

    let config = Arc::new(config);

    let (upstream_host, upstream_port) = parse_upstream_address(&config.server)?;
    info!(host = %upstream_host, port = upstream_port, "Resolving upstream address");

    let upstream_addr = (upstream_host.as_str(), upstream_port)
        .to_socket_addrs()
        .context("Failed to parse upstream address")?
        .next()
        .context("Failed to resolve upstream address")?;
    info!(addr = %upstream_addr, "Resolved upstream address");

    let socket_addrs = [
        SocketAddr::from((Ipv6Addr::UNSPECIFIED, config.listen_ws)),
        SocketAddr::from((Ipv4Addr::UNSPECIFIED, config.listen_ws)),
    ];

    let listener = TcpListener::bind(&socket_addrs[..])
        .await
        .with_context(|| format!("Failed to bind to port {}", config.listen_ws))?;

    info!(port = config.listen_ws, "WebSocket listener started");
    info!("Waiting for client connections...");

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
    let accept_invalid_certs = config.accept_invalid_certificate;
    
    let server_future = async move {
        let stream = TcpStream::connect(&upstream_addr).await?;
        
        let connector: TlsConnector = native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(accept_invalid_certs)
            .build()
            .unwrap()
            .into();
        
        let tls_stream = connector.connect(&upstream_host, stream).await?;
        Ok::<_, Error>(ClientControlCodec::new().framed(tls_stream))
    };

    let ws_config = WebSocketConfig {
        max_send_queue: Some(10),
        max_message_size: Some(0x7f_ffff),
        max_frame_size: Some(0x7f_ffff),
        accept_unmasked_frames: false,
        ..Default::default()
    };

    let client_future = async {
        let callback = |_req: &Request, mut response: Response| {
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
    
    // Transform WebSocket messages to ControlPackets
    let client_sink_mapped = client_sink.with(|msg: ControlPacket<Clientbound>| {
        let raw = RawControlPacket::from(msg);
        let mut header = BytesMut::with_capacity(6);
        header.put_u16(raw.id);
        header.put_u32(raw.bytes.len() as u32);
        let mut buf = Vec::with_capacity(6 + raw.bytes.len());
        buf.extend_from_slice(&header);
        buf.extend_from_slice(&raw.bytes);
        future::ready(Ok::<_, Error>(Message::Binary(buf)))
    });

    let client_stream_mapped = client_stream.err_into().try_filter_map(|msg| {
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

    Connection::new(
        config,
        client_sink_mapped,
        client_stream_mapped,
        server_sink.err_into(),
        server_stream.err_into(),
    )
    .await?;

    info!(client = %addr, "Connection closed");
    Ok(())
}
