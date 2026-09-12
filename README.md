# 🚀 mumble-web-proxy — Modernized Code Review

Интерактивный веб-сайт с обновлённым кодом mumble-web-proxy и пошаговой инструкцией по загрузке в GitHub.

## 📋 Что внутри

### 1️⃣ Вкладка "Код"
- **Обзор изменений** — 12 карточек с описанием всех модернизаций
- **File Explorer** — переключение между файлами (Cargo.toml, main.rs, error.rs, connection.rs)
- **Split View** — сравнение старого и нового кода бок о бок
- **Поиск** — поиск по коду с подсветкой
- **Копирование** — кнопка для быстрого копирования кода

### 2️⃣ Вкладка "Инструкция"
Пошаговое руководство из 8 шагов:
1. Подготовка окружения (git, Rust, SSH)
2. Клонирование репозитория
3. Создание ветки для изменений
4. Копирование обновлённого кода
5. Проверка и сборка (cargo check/build/test)
6. Коммит и пуш
7. Создание Pull Request
8. Настройка GitHub Actions (опционально)

## 🎯 Основные изменения в коде

| Категория | Было | Стало |
|-----------|------|-------|
| **Rust Edition** | 2018 | 2021 |
| **CLI Parsing** | argparse | clap v4 (derive) |
| **TLS Library** | native-tls | rustls |
| **Error Handling** | Ручные From impl | thiserror + anyhow |
| **Logging** | println! | tracing |
| **WebSocket** | tungstenite 0.12 | tungstenite 0.21 |
| **Async Runtime** | tokio 1.0 | tokio 1.35 |
| **Config** | toml 0.5 | toml 0.8 |
| **Code Quality** | unwrap() повсюду | proper error handling |
| **Memory Safety** | Box::leak | Arc<String> |

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

1. **Откройте сайт** и переключитесь на вкладку **"Инструкция"**
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

## 🛠️ Технологии

- **React 18** + **TypeScript**
- **Vite** — быстрый сборщик
- **Tailwind CSS** — стилизация
- **Font Awesome** — иконки

## 📁 Структура проекта

```
src/
├── App.tsx                      # Главный компонент с навигацией
├── main.tsx                     # Точка входа
├── index.css                    # Глобальные стили
└── components/
    ├── CodeViewer.tsx           # Просмотр кода с split view
    ├── ChangesOverview.tsx      # Карточки с изменениями
    ├── FileExplorer.tsx         # Переключатель файлов
    └── GitGuide.tsx             # Пошаговая инструкция

public/
└── (статические файлы)
```

## 🎨 Возможности UI

- ✅ **Тёмная тема** — оптимизирована для разработчиков
- ✅ **Адаптивный дизайн** — работает на мобильных и десктопах
- ✅ **Split View** — сравнение кода бок о бок
- ✅ **Подсветка синтаксиса** — поиск с выделением
- ✅ **Копирование в буфер** — одной кнопкой
- ✅ **Прогресс-бар** — отслеживание шагов в инструкции
- ✅ **Быстрая шпаргалка** — команды для быстрого доступа

## 📝 Лицензия

Оригинальный код mumble-web-proxy лицензирован под **AGPL-3.0**.

## 🔗 Ссылки

- [Оригинальный репозиторий](https://github.com/Johni0702/mumble-web-proxy)
- [Ваш репозиторий](https://github.com/ZwerG-MaX/mumble-web-proxy)
- [Mumble Wiki](https://wiki.mumble.info)

---

**Сделано с ❤️ для open-source сообщества**
