# mumble-web-proxy Rust Backend

Полная реализация Mumble to WebSocket+WebRTC proxy на Rust 1.88+ с использованием workspace.

## 🏗️ Структура workspace

```
rust-backend/
├── Cargo.toml              # Workspace configuration
├── mumble-protocol/        # Mumble protocol implementation
│   ├── Cargo.toml
│   ├── build.rs            # Protobuf code generation
│   ├── proto/
│   │   └── Mumble.proto    # Protocol buffer definitions
│   └── src/
│       ├── lib.rs          # Codec, message types
│       ├── control.rs      # Control packet wrapper
│       └── voice.rs        # Voice packet parser
├── rtp/                    # RTP/RTCP/SRTP implementation
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── traits.rs       # ReadPacket/WritePacket traits
│       ├── rfc3550.rs      # RTP/RTCP (RFC 3550)
│       ├── rfc5761.rs      # Multiplexing (RFC 5761)
│       └── rfc5764.rs      # DTLS-SRTP (RFC 5764)
└── proxy/                  # Main proxy application
    ├── Cargo.toml
    └── src/
        ├── main.rs         # Entry point, WebSocket listener
        ├── connection.rs   # Connection handler
        └── error.rs        # Error types
```

## 🚀 Сборка

### Из корня репозитория

```bash
# Перейти в директорию rust-backend
cd rust-backend

# Собрать все crates
cargo build --release

# Собрать только proxy
cargo build --release --package mumble-web-proxy

# Запустить
./target/release/mumble-web-proxy \
  --listen-ws 64737 \
  --server mumble.example.com:64738
```

### Из директории proxy

```bash
cd rust-backend/proxy
cargo build --release
./target/release/mumble-web-proxy --help
```

## 📦 Crates

### mumble-protocol

Реализация протокола Mumble с использованием Protobuf 3:
- Codec для TCP control channel
- Все типы сообщений Mumble
- WebRTC расширения
- Voice packet parser/serializer

**Зависимости:**
- `prost` 0.13 — Protobuf 3 runtime
- `prost-build` 0.13 — Code generator
- `tokio-util` 0.7 — Codec traits
- `bytes` 1.9 — Byte buffer

### rtp

Собственная реализация RTP/RTCP/SRTP:
- RFC 3550 (RTP/RTCP)
- RFC 5761 (Multiplexing)
- RFC 5764 (DTLS-SRTP)

**Зависимости:**
- `bytes` 1.9
- `byteorder` 1.5
- `openssl` 0.10

### proxy

Основное приложение прокси:
- WebSocket listener
- TLS терминация
- ICE/WebRTC интеграция
- Connection handler

**Зависимости:**
- `tokio` 1.42
- `tokio-tungstenite` 0.24
- `tokio-rustls` 0.26
- `libnice` 0.4
- `clap` 4.5

## 🔧 Системные требования

```bash
# Debian/Ubuntu
sudo apt-get install \
  rustc-1.88 \
  libnice-dev \
  libssl-dev \
  clang \
  protobuf-compiler \
  pkg-config

# Fedora
sudo dnf install \
  rust-1.88 \
  libnice-devel \
  openssl-devel \
  clang \
  protobuf-compiler \
  pkgconf-pkg-config
```

## 🐛 Отладка

```bash
# Включить debug логи
RUST_LOG=debug cargo run --release -- \
  --listen-ws 64737 \
  --server mumble:64738

# Трассировка ICE candidates
RUST_LOG=mumble_web_proxy::connection=debug cargo run --release

# Полная трассировка
RUST_LOG=trace cargo run --release
```

## 📊 Тестирование

```bash
# Запустить тесты для всех crates
cargo test --workspace

# Запустить тесты для конкретного crate
cargo test --package mumble-protocol
cargo test --package rtp
cargo test --package mumble-web-proxy
```

## 🔗 Ссылки

- [Оригинальный проект](https://github.com/Johni0702/mumble-web-proxy)
- [Mumble Wiki](https://wiki.mumble.info)
- [RFC 3550 - RTP](https://tools.ietf.org/html/rfc3550)
- [RFC 5764 - DTLS-SRTP](https://tools.ietf.org/html/rfc5764)

## 📄 Лицензия

AGPL-3.0
