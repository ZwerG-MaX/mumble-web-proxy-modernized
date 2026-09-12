# mumble-web-proxy - Современная версия

## 📋 Статус проекта

Этот проект представляет собой попытку модернизации оригинального [mumble-web-proxy](https://github.com/Johni0702/mumble-web-proxy) для работы с современным Rust (2024-2026).

## ⚠️ Текущие проблемы

### Проблемы совместимости

Оригинальные репозитории Johni0702 используют устаревшие зависимости:

1. **mumble-protocol** (v0.4.1, 2021)
   - protobuf 2 (устарел, современная версия - 3.x)
   - tokio-util 0.6 (несовместим с современным tokio)
   - edition 2018

2. **rtp** (fork от sile/rtp, 2017-2018)
   - trackable 0.1 (устарел)
   - handy_async 0.2 (устарел)
   - rust-crypto 0.2 (устарел, не поддерживается)
   - Не имеет Cargo.toml с современными зависимостями

3. **libnice** (v0.3.0, 2021)
   - glib 0.10 (устарел)
   - edition 2018

### Почему полная переделка сложна

1. **Объём работы**: Требуется переписать ~3000+ строк кода в трёх репозиториях
2. **Protobuf миграция**: Переход с protobuf 2 на 3.x требует полной переделки генерации кода
3. **RTP реализация**: Оригинальный rtp использует устаревшие криптографические библиотеки
4. **Тестирование**: WebRTC/ICE/DTLS-SRTP требуют сложного тестирования с реальными клиентами

## 🔧 Альтернативные решения

### Вариант 1: Использовать оригинальный код с фиксированными версиями

Самый надёжный способ - использовать оригинальный код с фиксацией версий зависимостей:

```bash
# Клонировать оригинальный репозиторий
git clone https://github.com/Johni0702/mumble-web-proxy.git
cd mumble-web-proxy

# Использовать Rust 1.75 (последняя версия, совместимая со старыми зависимостями)
rustup default 1.75.0

# Собрать
cargo build --release
```

### Вариант 2: Использовать Docker с фиксированной версией Rust

```dockerfile
FROM rust:1.75-bookworm AS builder
# ... остальной Dockerfile
```

### Вариант 3: Ждать обновления оригинального репозитория

Автор оригинального репозитория (Johni0702) может обновить зависимости в будущем. Следите за обновлениями:
- https://github.com/Johni0702/mumble-web-proxy
- https://github.com/Johni0702/rust-mumble-protocol
- https://github.com/Johni0702/rtp

### Вариант 4: Использовать альтернативные проекты

Существуют альтернативные реализации Mumble клиентов:

1. **mumble-web** (оригинальный веб-клиент)
   - https://github.com/Johni0702/mumble-web
   - Работает напрямую с mumble-web-proxy

2. **Нативный Mumble клиент**
   - https://github.com/mumble-voip/mumble
   - Не требует прокси

## 📊 Что было сделано в этом проекте

### Веб-интерфейс (React + TypeScript)
✅ Полностью рабочий веб-сайт с:
- Обзором изменений в коде
- Сравнением старого и нового кода (split view)
- Инструкцией по загрузке в GitHub
- Инструкцией по запуску через Podman Quadlet
- Поиском по коду
- Копированием кода в буфер обмена

### Rust backend (попытка модернизации)
⚠️ Частично реализовано:
- Обновлён Cargo.toml с современными версиями
- Создана упрощённая структура проекта
- Подготовлены Dockerfile и Quadlet конфигурация

❌ Не завершено:
- Полная переделка mumble-protocol на protobuf 3
- Создание современной реализации RTP
- Обновление libnice bindings
- Интеграционное тестирование

## 🚀 Быстрый старт (рекомендуемый способ)

Используйте оригинальный репозиторий с Docker:

```bash
# Клонировать оригинальный репозиторий
git clone https://github.com/Johni0702/mumble-web-proxy.git
cd mumble-web-proxy

# Собрать Docker образ с Rust 1.75
docker build -t mumble-web-proxy:latest .

# Запустить
docker run -d \
  --name mumble-web-proxy \
  -p 64737:64737 \
  -p 20000-21000:20000-21000/udp \
  mumble-web-proxy:latest \
  --listen-ws 64737 \
  --server mumble.example.com:64738
```

## 📚 Ресурсы

### Оригинальные репозитории
- [mumble-web-proxy](https://github.com/Johni0702/mumble-web-proxy) - основной прокси
- [rust-mumble-protocol](https://github.com/Johni0702/rust-mumble-protocol) - протокол Mumble
- [rtp](https://github.com/Johni0702/rtp) - RTP/RTCP/DTLS-SRTP
- [rust-libnice](https://github.com/Johni0702/rust-libnice) - ICE bindings
- [mumble-web](https://github.com/Johni0702/mumble-web) - веб-клиент

### Документация
- [Mumble Wiki](https://wiki.mumble.info)
- [RFC 3550 - RTP](https://tools.ietf.org/html/rfc3550)
- [RFC 3711 - SRTP](https://tools.ietf.org/html/rfc3711)
- [RFC 5764 - DTLS-SRTP](https://tools.ietf.org/html/rfc5764)

## 🤝 Вклад в проект

Если вы хотите помочь с модернизацией:

1. **Fork** оригинальных репозиториев
2. **Обновите** зависимости на современные версии
3. **Исправьте** проблемы совместимости
4. **Протестируйте** с реальными Mumble серверами
5. **Создайте Pull Request** в оригинальные репозитории

Ключевые области для улучшения:
- Миграция protobuf 2 → 3.x в mumble-protocol
- Обновление rtp crate без устаревших зависимостей
- Обновление libnice bindings
- Интеграционное тестирование WebRTC

## 📄 Лицензия

Оригинальный код: AGPL-3.0 (Johni0702)
Веб-интерфейс: MIT

---

**Примечание**: Этот проект демонстрирует сложности модернизации устаревшего Rust кода. Полная переделка требует значительных временных затрат и глубокого понимания протоколов Mumble, WebRTC, ICE, DTLS-SRTP.
