# 🐳 Podman Quadlet Configuration

Эта директория содержит файлы конфигурации для запуска mumble-web-proxy через Podman Quadlet с systemd.

## 📦 Файлы

- **mumble-web-proxy.container** — основная конфигурация контейнера
- **mumble-web-proxy.volume** — persistent volume для конфигурации
- **mumble-web-proxy.network** — изолированная сеть (опционально)
- **install-quadlet.sh** — скрипт автоматической установки

## 🚀 Быстрая установка

```bash
# Сделать скрипт исполняемым
chmod +x install-quadlet.sh

# Запустить установку
./install-quadlet.sh

# Отредактировать конфигурацию
nano ~/.local/share/containers/storage/volumes/mumble-web-proxy-config/_data/config.toml

# Запустить сервис
systemctl --user start mumble-web-proxy.service
systemctl --user enable mumble-web-proxy.service
```

## 📋 Ручная установка

```bash
# Создать директорию для Quadlet
mkdir -p ~/.config/containers/systemd

# Скопировать файлы
cp mumble-web-proxy.container ~/.config/containers/systemd/
cp mumble-web-proxy.volume ~/.config/containers/systemd/
cp mumble-web-proxy.network ~/.config/containers/systemd/

# Перезагрузить systemd
systemctl --user daemon-reload

# Запустить
systemctl --user start mumble-web-proxy.service
```

## 🔧 Команды управления

```bash
# Статус
systemctl --user status mumble-web-proxy.service

# Логи
journalctl --user -u mumble-web-proxy.service -f

# Перезапуск
systemctl --user restart mumble-web-proxy.service

# Остановка
systemctl --user stop mumble-web-proxy.service

# Отключить автозапуск
systemctl --user disable mumble-web-proxy.service
```

## ⚙️ Конфигурация

После установки отредактируйте файл конфигурации:

```bash
nano ~/.local/share/containers/storage/volumes/mumble-web-proxy-config/_data/config.toml
```

Основные параметры:
- `listen-ws` — порт WebSocket (по умолчанию 64737)
- `server` — адрес Mumble сервера (например, `localhost:64738`)
- `ice-port-min` / `ice-port-max` — диапазон портов для WebRTC
- `ice-ipv4` / `ice-ipv6` — публичные IP для NAT traversal

Параметры Quadlet (.container файл):
- `Memory=256m` — ограничение памяти (НЕ MemoryLimit!)
- `CPUs=0.5` — ограничение CPU (НЕ CPUQuota!)

## 🔒 Безопасность

Контейнер запускается с усиленными настройками безопасности:
- Read-only файловая система
- NoNewPrivileges
- Ограничения по памяти и CPU
- Изолированная сеть (опционально)

## 🐛 Отладка

```bash
# Проверить сгенерированный systemd unit
systemctl --user cat mumble-web-proxy.service

# Посмотреть логи Podman
podman logs mumble-web-proxy

# Войти в контейнер
podman exec -it mumble-web-proxy /bin/sh

# Проверить статистику ресурсов
podman stats mumble-web-proxy
```

## 📚 Документация

- [Podman Quadlet Documentation](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
- [Systemd User Services](https://wiki.archlinux.org/title/Systemd/User)
- [Mumble-Web-Proxy](https://github.com/ZwerG-MaX/mumble-web-proxy)

## 🆘 Проблемы

### Контейнер не запускается
```bash
# Проверить логи
journalctl --user -u mumble-web-proxy.service -n 50

# Проверить конфигурацию
podman inspect mumble-web-proxy
```

### Порт уже занят
```bash
# Проверить, кто использует порт
sudo lsof -i :64737

# Изменить порт в config.toml
```

### WebRTC не работает
- Убедитесь, что порты 20000-21000/udp открыты в firewall
- Настройте `ice-ipv4` / `ice-ipv6` с публичными IP
- Проверьте, что Mumble сервер поддерживает WebRTC

---

**Сделано с ❤️ для удобного развёртывания**
