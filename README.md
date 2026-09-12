# 🚀 mumble-web-proxy — Modernized Code Review

Интерактивный веб-сайт с обновлённым кодом mumble-web-proxy и пошаговой инструкцией по загрузке в GitHub.

## 📋 Что внутри

### 1️⃣ Вкладка "Код"
- **Обзор изменений** — 12 карточек с описанием всех модернизаций
- **File Explorer** — переключение между файлами (Cargo.toml, main.rs, error.rs, connection.rs)
- **Split View** — сравнение старого и нового кода бок о бок
- **Поиск** — поиск по коду с подсветкой
- **Копирование** — кнопка для быстрого копирования кода

### 2️⃣ Вкладка "GitHub"
Пошаговое руководство из 8 шагов:
1. Подготовка окружения (git, Rust, SSH)
2. Клонирование репозитория
3. Создание ветки для изменений
4. Копирование обновлённого кода
5. Проверка и сборка (cargo check/build/test)
6. Коммит и пуш
7. Создание Pull Request
8. Настройка GitHub Actions (опционально)

### 3️⃣ Вкладка "Podman"
Полное руководство по запуску через Podman Quadlet + systemd:
- **Обзор** — что такое Quadlet и его преимущества
- **Container** — файл .container с конфигурацией контейнера
- **Volume** — файл .volume для persistent storage
- **Network** — файл .network для изолированной сети
- **Systemd Service** — как выглядит сгенерированный service
- **Команды** — все команды для управления сервисом

## 🎯 Основные изменения в коде

| Категория | Было | Стало |
|-----------|------|-------|
| **Rust Edition** | 2018 | 2021 |
| **CLI Parsing** | argparse | clap v4 (derive) |
| **Error Handling** | Ручные From impl | thiserror + anyhow |
| **Logging** | println! | tracing |
| **WebSocket** | tungstenite 0.12 | tungstenite 0.21 |
| **Async Runtime** | tokio 1.0 | tokio 1.35 |
| **Config** | toml 0.5 | toml 0.8 |
| **Code Quality** | unwrap() повсюду | proper error handling |
| **Memory Safety** | Box::leak | Arc<String> |

### ⚠️ Примечание о WebRTC

Текущая версия содержит **упрощённую реализацию** прокси, которая фокусируется на базовой функциональности TCP WebSocket проксирования. Полная поддержка WebRTC/ICE/DTLS-SRTP требует дополнительных зависимостей (libnice, rtp, webrtc-sdp, openssl) и более сложной реализации.

Для production-использования с полной поддержкой WebRTC рекомендуется использовать оригинальный код из репозитория Johni0702/mumble-web-proxy или расширить текущую версию.

## 🚀 Быстрый старт

### Локальный запуск

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev

# Сборка для production
npm run build

# Предпросмотр production-сборки
npm run preview
```

### Как залить код в GitHub

1. **Откройте сайт** и переключитесь на вкладку **"GitHub"**
2. **Следуйте 8 шагам** — каждый шаг содержит команды и объяснения
3. **Используйте кнопку "Copy"** для копирования кода из вкладки "Код"
4. **Замените файлы** в вашем репозитории на обновлённые версии
5. **Закоммитьте и запушьте** изменения

#### Краткая версия:

```bash
# Клонирование
git clone git@github.com:ZwerG-MaX/mumble-web-proxy.git
cd mumble-web-proxy

# Создание ветки
git checkout -b modernize/rust-2021

# ... замените файлы кодом из сайта ...

# Проверка
cargo build

# Коммит
git add .
git commit -m "Modernize: Rust 2021 + latest deps"

# Пуш
git push origin modernize/rust-2021
```

### Как запустить через Podman Quadlet

1. **Соберите образ** контейнера локально
2. **Откройте сайт** и переключитесь на вкладку **"Podman"**
3. **Скопируйте файлы** `.container`, `.volume`, `.network`
4. **Поместите их** в `~/.config/containers/systemd/`
5. **Перезагрузите systemd** и запустите сервис

#### Краткая версия:

```bash
# 1. Собрать образ контейнера
chmod +x build-image.sh
./build-image.sh

# 2. Создать директорию для Quadlet
mkdir -p ~/.config/containers/systemd

# 3. Скопировать файлы Quadlet
cp quadlet/mumble-web-proxy.{container,volume,network} ~/.config/containers/systemd/

# 4. Перезагрузить и запустить
systemctl --user daemon-reload
systemctl --user start mumble-web-proxy.service
systemctl --user enable mumble-web-proxy.service

# 5. Проверить статус
systemctl --user status mumble-web-proxy.service

# Смотреть логи
journalctl --user -u mumble-web-proxy.service -f
```

#### Проверка работы:

```bash
# Проверить, что контейнер запущен
podman ps | grep mumble-web-proxy

# Проверить логи
journalctl --user -u mumble-web-proxy.service -f

# Проверить, что порт слушается
ss -tlnp | grep 64737
```

## 🛠️ Технологии

### Веб-сайт (React)
- **React 18** + **TypeScript**
- **Vite** — быстрый сборщик
- **Tailwind CSS** — стилизация
- **Font Awesome** — иконки

### Backend (Rust)
- **Rust 2021** — современная редакция
- **Tokio** — async runtime
- **clap v4** — CLI parsing
- **mumble-protocol** — протокол Mumble
- **tungstenite** — WebSocket
- **native-tls** — TLS для upstream соединений
- **tracing** — структурированное логирование
- **thiserror + anyhow** — обработка ошибок

### Контейнеризация
- **Podman** — контейнерный runtime
- **Quadlet** — интеграция с systemd
- **Multi-stage Dockerfile** — оптимизированная сборка

## 📁 Структура проекта

```
.
├── src/                         # React веб-сайт
│   ├── App.tsx                  # Главный компонент с навигацией
│   ├── main.tsx                 # Точка входа
│   ├── index.css                # Глобальные стили
│   └── components/
│       ├── CodeViewer.tsx       # Просмотр кода с split view
│       ├── ChangesOverview.tsx  # Карточки с изменениями
│       ├── FileExplorer.tsx     # Переключатель файлов
│       ├── GitGuide.tsx         # Пошаговая инструкция по GitHub
│       └── PodmanGuide.tsx      # Инструкция по Podman Quadlet
│
├── rust-backend/                # Rust код mumble-web-proxy
│   ├── Cargo.toml               # Зависимости Rust
│   └── src/
│       ├── main.rs              # Точка входа
│       ├── connection.rs        # Обработчик соединений
│       └── error.rs             # Типы ошибок
│
├── quadlet/                     # Конфигурация Podman Quadlet
│   ├── mumble-web-proxy.container
│   ├── mumble-web-proxy.volume
│   ├── mumble-web-proxy.network
│   └── install-quadlet.sh
│
├── Dockerfile                   # Multi-stage сборка контейнера
├── build-image.sh               # Скрипт сборки образа
└── README.md                    # Документация
```

## 🎨 Возможности UI

- ✅ **Тёмная тема** — оптимизирована для разработчиков
- ✅ **Адаптивный дизайн** — работает на мобильных и десктопах
- ✅ **Split View** — сравнение кода бок о бок
- ✅ **Подсветка синтаксиса** — поиск с выделением
- ✅ **Копирование в буфер** — одной кнопкой
- ✅ **Прогресс-бар** — отслеживание шагов в инструкции
- ✅ **Быстрая шпаргалка** — команды для быстрого доступа
- ✅ **Podman Quadlet** — полная инструкция по запуску через systemd
- ✅ **Три вкладки** — Код / GitHub / Podman

## 📝 Лицензия

Оригинальный код mumble-web-proxy лицензирован под **AGPL-3.0**.

## 🔗 Ссылки

- [Оригинальный репозиторий](https://github.com/Johni0702/mumble-web-proxy)
- [Ваш репозиторий](https://github.com/ZwerG-MaX/mumble-web-proxy)
- [Mumble Wiki](https://wiki.mumble.info)

---

**Сделано с ❤️ для open-source сообщества**
