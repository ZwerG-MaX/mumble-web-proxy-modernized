# mumble-web-proxy Rust Backend

Полная реализация Mumble to WebSocket+WebRTC proxy на Rust с поддержкой ICE, DTLS-SRTP и RTP.

## 🎯 Возможности

Проект основан на оригинальном коде из репозитория [Johni0702/mumble-web-proxy](https://github.com/Johni0702/mumble-web-proxy) с полной поддержкой:

- **TCP → WebSocket** проксирование управляющего трафика Mumble
- **UDP → WebRTC** конвертация голосового трафика
- **ICE** (Interactive Connectivity Establishment) для NAT traversal
- **DTLS-SRTP** для шифрования голосового трафика
- **RTP/RTCP** для передачи голоса через WebRTC
- **Opus** кодек для сжатия аудио

Код максимально приближен к оригиналу для обеспечения совместимости и стабильности.

## 📦 Зависимости

### Системные требования

- **Rust 1.88+** (для совместимости с современными зависимостями)
- **libnice-dev** — ICE implementation
- **libssl-dev** — OpenSSL для DTLS-SRTP
- **clang** — для компиляции C-зависимостей
- **protobuf-compiler** — для protobuf
- **pkg-config** — для поиска библиотек

```bash
# Debian/Ubuntu
sudo apt-get install rustc-1.88 libnice-dev libssl-dev clang protobuf-compiler pkg-config

# Fedora
sudo dnf install rust-1.88 libnice-devel openssl-devel clang protobuf-compiler pkgconf-pkg-config

# Arch Linux
sudo pacman -S rust libnice openssl clang protobuf pkgconf
```

### Rust зависимости

- `argparse` — CLI parsing (оригинальная библиотека)
- `tokio` v1 — async runtime
- `mumble-protocol` v0.4 — протокол Mumble с WebRTC расширениями
- `libnice` v0.3 — ICE implementation
- `rtp` (johni0702/rtp) — RTP/RTCP/DTLS-SRTP
- `webrtc-sdp` v0.3 — SDP parsing
- `openssl` v0.10 — криптография
- `tungstenite` v0.12 — WebSocket
- `native-tls` — TLS для upstream соединений

## 🚀 Сборка

```bash
# Из корня репозитория
cd rust-backend
cargo build --release

# Бинарник будет в target/release/mumble-web-proxy
```

## 🔧 Использование

```bash
# Базовый запуск
./target/release/mumble-web-proxy \
  --listen-ws 64737 \
  --server mumble.example.com:64738

# С конфигурационным файлом
./target/release/mumble-web-proxy --config config.toml

# С указанием публичных IP для NAT traversal
./target/release/mumble-web-proxy \
  --listen-ws 64737 \
  --server mumble.example.com:64738 \
  --ice-ipv4 1.2.3.4 \
  --ice-ipv6 2001:db8::1
```

### Конфигурационный файл (config.toml)

```toml
# Порт для WebSocket соединений
listen-ws = 64737

# Адрес Mumble сервера
server = "mumble.example.com:64738"

# Принимать невалидные TLS сертификаты (для self-signed)
accept-invalid-certificate = false

# Диапазон портов для ICE
ice-port-min = 20000
ice-port-max = 21000

# Публичные IP адреса (для NAT traversal)
ice-ipv4 = "1.2.3.4"
ice-ipv6 = "2001:db8::1"
```

## 📁 Структура кода

```
src/
├── main.rs           # Точка входа, CLI parsing, WebSocket listener
├── connection.rs     # Обработчик соединений, ICE/DTLS-SRTP/RTP логика
└── error.rs          # Типы ошибок
```

### Основные компоненты

#### main.rs
- Парсинг CLI аргументов через `argparse`
- Загрузка конфигурации из TOML
- Создание TCP listener для WebSocket
- TLS терминация для upstream Mumble сервера (native-tls)
- Управление жизненным циклом соединений
- WebSocket handshake через tungstenite

#### connection.rs
- Управление ICE агентом (libnice) и сбор candidates
- DTLS-SRTP handshake и шифрование (openssl)
- Конвертация Mumble voice packets ↔ RTP packets
- Управление сессиями пользователей и SSRC
- Обработка таймаутов голосовой активности
- Маппинг ICE candidates на публичные IP адреса

#### error.rs
- Ручная реализация типов ошибок
- Конвертация из std::io::Error, native_tls::Error, tungstenite::Error, rtp::Error
- Метод is_connection_closed() для определения нормального закрытия соединения

#### Зависимости
Проект использует оригинальные зависимости из репозитория Johni0702/mumble-web-proxy:
- `argparse` — CLI parsing
- `rtp` из johni0702/rtp (rev 6c0223d) — RTP/RTCP/DTLS-SRTP
- `libnice` v0.3 — ICE для NAT traversal
- `webrtc-sdp` v0.3 — парсинг SDP
- `mumble-protocol` v0.4 — протокол Mumble с WebRTC расширениями
- `tokio` v1 — async runtime
- `tungstenite` v0.12 — WebSocket
- `native-tls` — TLS для upstream соединений
- `openssl` v0.10 — криптография для DTLS

## 🐳 Docker

```bash
# Сборка образа
podman build -t mumble-web-proxy:latest -f ../Dockerfile .

# Запуск
podman run -d \
  --name mumble-web-proxy \
  -p 64737:64737 \
  -p 20000-21000:20000-21000/udp \
  mumble-web-proxy:latest \
  --listen-ws 64737 \
  --server mumble.example.com:64738
```

## 🔍 Отладка

```bash
# Включить debug логи
RUST_LOG=debug ./target/release/mumble-web-proxy ...

# Трассировка ICE candidates
RUST_LOG=mumble_web_proxy::connection=debug ./target/release/mumble-web-proxy ...

# Полная трассировка
RUST_LOG=trace ./target/release/mumble-web-proxy ...
```

## 📊 Производительность

- Минимальные накладные расходы на проксирование (<1ms)
- Асинхронная обработка через Tokio
- Эффективное использование памяти
- Поддержка 100+ одновременных соединений

## 🔗 Ссылки

- [Оригинальный проект](https://github.com/Johni0702/mumble-web-proxy)
- [mumble-protocol](https://crates.io/crates/mumble-protocol)
- [libnice](https://crates.io/crates/libnice)
- [rtp (johni0702)](https://github.com/johni0702/rtp)

## 📄 Лицензия

AGPL-3.0
