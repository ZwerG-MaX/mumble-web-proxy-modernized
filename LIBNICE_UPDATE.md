# ✅ Полная переделка libnice на Rust 1.88+

## 🎉 Статус: ЗАВЕРШЕНО

Обновлены библиотеки libnice-sys и libnice для работы с современным Rust 1.88+.

## 📊 Что было сделано

### 1. libnice-sys 0.5.0 (FFI bindings)

**Обновления:**
- ✅ bindgen 0.70 (вместо 0.56)
- ✅ glib-sys 0.20 (вместо 0.10)
- ✅ gobject-sys 0.20 (вместо 0.10)
- ✅ gio-sys 0.20 (вместо 0.10)
- ✅ Edition 2021
- ✅ allowlist_* вместо устаревших whitelist_* API

**Файлы:**
- `Cargo.toml` - обновлённые зависимости
- `build.rs` - современный bindgen API
- `src/lib.rs` - FFI bindings

### 2. libnice 0.4.0 (high-level bindings)

**Обновления:**
- ✅ glib 0.20 (вместо 0.10)
- ✅ webrtc-sdp 0.4 (вместо 0.3)
- ✅ Edition 2021
- ✅ Современный glib::wrapper! макрос
- ✅ Полная поддержка ICE agent API
- ✅ AsyncRead/AsyncWrite для StreamComponent

**Файлы:**
- `Cargo.toml` - обновлённые зависимости
- `src/lib.rs` - module exports
- `src/ffi.rs` - safe FFI wrapper с glib 0.20
- `src/ice.rs` - high-level ICE agent implementation

### 3. Интеграция в mumble-web-proxy

**Обновления:**
- ✅ Добавлены libnice-sys и libnice в workspace
- ✅ proxy использует локальную версию libnice через path dependency
- ✅ Удалена зависимость от crates.io libnice 0.4 (которой не существует)

## 🏗️ Структура workspace

```
rust-backend/
├── Cargo.toml              # Workspace с 5 crates
├── libnice-sys/            # FFI bindings (обновлены)
│   ├── Cargo.toml
│   ├── build.rs
│   └── src/lib.rs
├── libnice/                # High-level bindings (обновлены)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── ffi.rs
│       └── ice.rs
├── mumble-protocol/        # Mumble protocol
├── rtp/                    # RTP/RTCP/SRTP
└── proxy/                  # Main proxy application
```

## 🚀 Как использовать

### Локальная сборка

```bash
# Установить зависимости
sudo apt-get install libnice-dev libssl-dev clang protobuf-compiler pkg-config

# Собрать проект
cd rust-backend
cargo build --release

# Запустить
./target/release/mumble-web-proxy \
  --listen-ws 64737 \
  --server mumble.example.com:64738
```

### Docker сборка

```bash
# Собрать образ
chmod +x build-image.sh
./build-image.sh

# Запустить
podman run -d \
  --name mumble-web-proxy \
  -p 64737:64737 \
  -p 20000-21000:20000-21000/udp \
  mumble-web-proxy:latest \
  --listen-ws 64737 \
  --server mumble.example.com:64738
```

## 📦 Обновлённые зависимости

### libnice-sys
- `bindgen` 0.56 → 0.70
- `glib-sys` 0.10 → 0.20
- `gobject-sys` 0.10 → 0.20
- `gio-sys` 0.10 → 0.20
- `libc` 0.2 (без изменений)
- `pkg-config` 0.3 (без изменений)

### libnice
- `glib` 0.10 → 0.20
- `webrtc-sdp` 0.3 → 0.4
- `libc` 0.2 (без изменений)
- `glib-sys` 0.10 → 0.20
- `gobject-sys` 0.10 → 0.20
- `futures` 0.3 (без изменений)
- `tokio` 1 → 1.42 (dev-dependency)

## 🔧 Ключевые изменения в коде

### bindgen API
```rust
// Старый API (bindgen 0.56)
.whitelist_function("nice_.+")
.whitelist_type("NICE.+")

// Новый API (bindgen 0.70)
.allowlist_function("nice_.+")
.allowlist_type("NICE.+")
```

### glib wrapper
```rust
// Старый API (glib 0.10)
glib_wrapper! {
    pub struct NiceAgent(Object<sys::NiceAgent, NiceAgentClass>);
    match fn {
        get_type => || sys::nice_agent_get_type(),
    }
}

// Новый API (glib 0.20)
mod imp {
    #[derive(Debug)]
    pub struct NiceAgent;

    #[glib::object_subclass]
    impl ObjectSubclass for NiceAgent {
        const NAME: &'static str = "NiceAgent";
        type Type = super::NiceAgent;
    }

    impl ObjectImpl for NiceAgent {}
}

glib::wrapper! {
    pub struct NiceAgent(ObjectSubclass<imp::NiceAgent>);
}
```

### Signal handlers
```rust
// Старый API (glib 0.10)
self.connect("new-candidate-full", false, move |values| {
    f(&values[1].get().unwrap().unwrap());
    None
})

// Новый API (glib 0.20)
self.connect_closure(
    "new-candidate-full",
    false,
    glib::closure_local!(move |_agent: glib::Object, candidate: NiceCandidate| {
        f(&candidate);
    }),
)
```

## 🐛 Отладка

```bash
# Включить debug логи
RUST_LOG=debug cargo run --release -- \
  --listen-ws 64737 \
  --server mumble:64738

# Трассировка ICE candidates
RUST_LOG=libnice::ice=debug cargo run --release

# Полная трассировка
RUST_LOG=trace cargo run --release
```

## 🔗 Ссылки

- [Оригинальный libnice-sys](https://github.com/Johni0702/rust-libnice-sys)
- [Оригинальный libnice](https://github.com/Johni0702/rust-libnice)
- [Обновлённый libnice-sys](https://github.com/ZwerG-MaX/rust-libnice-sys)
- [Обновлённый libnice](https://github.com/ZwerG-MaX/rust-libnice)
- [libnice C library](https://nice.freedesktop.org/wiki/)

## 📄 Лицензия

LGPL-2.1 OR MPL-1.1 (как в оригинальном libnice)

---

**Полная переделка libnice-sys и libnice на Rust 1.88+ с современными зависимостями**

**Статус: ✅ ЗАВЕРШЕНО И ГОТОВО К ИСПОЛЬЗОВАНИЮ**
