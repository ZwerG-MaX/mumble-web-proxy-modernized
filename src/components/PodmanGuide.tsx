import { useState } from 'react'

export default function PodmanGuide() {
  const [activeTab, setActiveTab] = useState<'overview' | 'container' | 'volume' | 'network' | 'service' | 'commands'>('overview')

  const tabs = [
    { id: 'overview' as const, label: 'Обзор', icon: 'fa-info-circle' },
    { id: 'container' as const, label: 'Container', icon: 'fa-box' },
    { id: 'volume' as const, label: 'Volume', icon: 'fa-database' },
    { id: 'network' as const, label: 'Network', icon: 'fa-network-wired' },
    { id: 'service' as const, label: 'Systemd Service', icon: 'fa-cogs' },
    { id: 'commands' as const, label: 'Команды', icon: 'fa-terminal' },
  ]

  return (
    <section className="py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Запуск через <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Podman Quadlet</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Современный способ управления контейнерами через systemd с автоматической генерацией unit-файлов
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <i className={`fas ${tab.icon} mr-2`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'container' && <ContainerTab />}
          {activeTab === 'volume' && <VolumeTab />}
          {activeTab === 'network' && <NetworkTab />}
          {activeTab === 'service' && <ServiceTab />}
          {activeTab === 'commands' && <CommandsTab />}
        </div>

        {/* Quick reference */}
        <div className="mt-8 p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <i className="fas fa-bolt text-yellow-400"></i>
            Быстрый старт (одной командой)
          </h3>
          <CodeBlock code={`# Создать директорию для Quadlet файлов
mkdir -p ~/.config/containers/systemd

# Скопировать все файлы (предполагается, что они в текущей директории)
cp mumble-web-proxy.container mumble-web-proxy.volume ~/.config/containers/systemd/

# Перезагрузить systemd
systemctl --user daemon-reload

# Запустить сервис
systemctl --user start mumble-web-proxy.service

# Включить автозапуск
systemctl --user enable mumble-web-proxy.service

# Проверить статус
systemctl --user status mumble-web-proxy.service`} />
        </div>
      </div>
    </section>
  )
}

function OverviewTab() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
          <i className="fas fa-info-circle text-blue-400"></i>
          Что такое Podman Quadlet?
        </h3>
        <p className="text-gray-400 leading-relaxed mb-4">
          <strong className="text-white">Podman Quadlet</strong> — это система для автоматической генерации systemd unit-файлов 
          из контейнерных конфигураций. Вместо ручного создания сложных systemd service файлов, вы пишете простые 
          .container, .volume, .network файлы, а Quadlet сам генерирует соответствующие systemd units.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
            <i className="fas fa-check-circle"></i>
            Преимущества
          </h4>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <i className="fas fa-chevron-right text-blue-400 mt-1 text-xs"></i>
              <span>Автоматическая генерация systemd units</span>
            </li>
            <li className="flex gap-2">
              <i className="fas fa-chevron-right text-blue-400 mt-1 text-xs"></i>
              <span>Интеграция с systemctl (start/stop/status/logs)</span>
            </li>
            <li className="flex gap-2">
              <i className="fas fa-chevron-right text-blue-400 mt-1 text-xs"></i>
              <span>Автозапуск при загрузке системы</span>
            </li>
            <li className="flex gap-2">
              <i className="fas fa-chevron-right text-blue-400 mt-1 text-xs"></i>
              <span>Автоматический рестарт при падении</span>
            </li>
            <li className="flex gap-2">
              <i className="fas fa-chevron-right text-blue-400 mt-1 text-xs"></i>
              <span>Логирование через journald</span>
            </li>
            <li className="flex gap-2">
              <i className="fas fa-chevron-right text-blue-400 mt-1 text-xs"></i>
              <span>Управление зависимостями между сервисами</span>
            </li>
          </ul>
        </div>

        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
          <h4 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
            <i className="fas fa-file-code"></i>
            Типы файлов Quadlet
          </h4>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <code className="text-purple-400">.container</code>
              <span>— описание контейнера</span>
            </li>
            <li className="flex gap-2">
              <code className="text-purple-400">.volume</code>
              <span>— описание volume</span>
            </li>
            <li className="flex gap-2">
              <code className="text-purple-400">.network</code>
              <span>— описание сети</span>
            </li>
            <li className="flex gap-2">
              <code className="text-purple-400">.kube</code>
              <span>— Kubernetes YAML</span>
            </li>
            <li className="flex gap-2">
              <code className="text-purple-400">.image</code>
              <span>— описание образа</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
          <i className="fas fa-lightbulb"></i>
          Требования
        </h4>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>• Podman 4.4 или новее (для Quadlet)</li>
          <li>• systemd (обычно предустановлен в Linux)</li>
          <li>• Права пользователя в группе podman (опционально для rootless)</li>
          <li>• Rust 1.88+ и зависимости для сборки (для сборки образа)</li>
        </ul>
      </div>

      <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
        <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
          <i className="fas fa-hammer"></i>
          Шаг 1: Сборка образа
        </h4>
        <p className="text-sm text-gray-300 mb-3">
          Перед использованием Quadlet нужно собрать образ контейнера локально:
        </p>
        <CodeBlock code={`# Из корня репозитория
chmod +x build-image.sh
./build-image.sh

# Или вручную:
podman build -t mumble-web-proxy:latest -f Dockerfile .

# Проверить, что образ создан:
podman images | grep mumble-web-proxy`} />
      </div>
    </div>
  )
}

function ContainerTab() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
          <i className="fas fa-box text-blue-400"></i>
          mumble-web-proxy.container
        </h3>
        <p className="text-gray-400 mb-4">
          Основной файл конфигурации контейнера. Quadlet автоматически сгенерирует из него systemd service.
        </p>
      </div>

      <CodeBlock code={`# mumble-web-proxy.container
[Unit]
Description=Mumble to WebSocket+WebRTC Proxy
Documentation=https://github.com/ZwerG-MaX/mumble-web-proxy
After=network-online.target
Wants=network-online.target

[Container]
# Образ контейнера (собрать локально через ./build-image.sh)
Image=localhost/mumble-web-proxy:latest

# Имя контейнера
ContainerName=mumble-web-proxy

# Порты
# WebSocket порт
PublishPort=64737:64737
# ICE/WebRTC UDP порты
PublishPort=20000-21000:20000-21000/udp

# Volumes
# Конфигурация
Volume=mumble-web-proxy-config:/etc/mumble-web-proxy:ro
# Логи (опционально)
Volume=mumble-web-proxy-logs:/var/log/mumble-web-proxy

# Переменные окружения
Environment=RUST_LOG=info

# Команда запуска
Exec=/usr/local/bin/mumble-web-proxy --config /etc/mumble-web-proxy/config.toml

# Ресурсы (через PodmanArgs для совместимости)
PodmanArgs=--memory=256m
PodmanArgs=--cpus=0.5
PodmanArgs=--memory-swap=512m

# Безопасность
ReadOnly=true
SecurityLabelType=container_runtime_t
NoNewPrivileges=true

# Сеть
Network=mumble-web-proxy-network.network

# Автозапуск
AutoUpdate=registry

[Install]
WantedBy=default.target`} />

      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          Пояснения
        </h4>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>• <code className="text-blue-400">PublishPort</code> — маппинг портов (хост:контейнер)</li>
          <li>• <code className="text-blue-400">Volume</code> — монтирование volumes (имя:путь:режим)</li>
          <li>• <code className="text-blue-400">Environment</code> — переменные окружения</li>
          <li>• <code className="text-blue-400">PodmanArgs=--memory=256m</code> — ограничение памяти</li>
          <li>• <code className="text-blue-400">PodmanArgs=--cpus=0.5</code> — ограничение CPU</li>
          <li>• <code className="text-blue-400">ReadOnly</code> — read-only файловая система</li>
          <li>• <code className="text-blue-400">NoNewPrivileges</code> — запрет повышения привилегий</li>
        </ul>
      </div>
    </div>
  )
}

function VolumeTab() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
          <i className="fas fa-database text-green-400"></i>
          mumble-web-proxy.volume
        </h3>
        <p className="text-gray-400 mb-4">
          Файл для создания persistent volume для конфигурации.
        </p>
      </div>

      <CodeBlock code={`# mumble-web-proxy.volume
[Volume]
# Имя volume (будет доступно как mumble-web-proxy-config)
# Опционально: можно указать driver и options
Driver=local

# Labels для организации
Label=app=mumble-web-proxy
Label=component=config

[Install]
WantedBy=default.target`} />

      <div className="mt-6">
        <h4 className="font-semibold mb-3">Альтернатива: Host Path Volume</h4>
        <p className="text-gray-400 text-sm mb-3">
          Если хотите использовать директорию на хосте вместо managed volume:
        </p>
        <CodeBlock code={`# В mumble-web-proxy.container замените:
Volume=/opt/mumble-web-proxy/config:/etc/mumble-web-proxy:ro

# И создайте директорию:
mkdir -p /opt/mumble-web-proxy/config
cp config.toml /opt/mumble-web-proxy/config/`} />
      </div>

      <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
        <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
          <i className="fas fa-lightbulb"></i>
          Совет
        </h4>
        <p className="text-sm text-gray-300">
          Используйте managed volumes для простоты управления. Host path volumes полезны, 
          если конфигурация уже существует на хосте или нужна интеграция с другими инструментами.
        </p>
      </div>
    </div>
  )
}

function NetworkTab() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
          <i className="fas fa-network-wired text-purple-400"></i>
          mumble-web-proxy.network
        </h3>
        <p className="text-gray-400 mb-4">
          Опциональный файл для создания изолированной сети.
        </p>
      </div>

      <CodeBlock code={`# mumble-web-proxy.network
[Network]
# Имя сети
Subnet=10.89.0.0/24
Gateway=10.89.0.1

# DNS (опционально)
DNS=8.8.8.8
DNS=8.8.4.4

# Labels
Label=app=mumble-web-proxy
Label=environment=production

# Внутренняя сеть (без доступа к интернету)
# Internal=true

[Install]
WantedBy=default.target`} />

      <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
        <h4 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          Когда нужна отдельная сеть?
        </h4>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>• Если нужно изолировать контейнер от других</li>
          <li>• Для статических IP-адресов</li>
          <li>• Для связи между несколькими контейнерами</li>
          <li>• Для ограничения доступа к интернету</li>
        </ul>
        <p className="text-sm text-gray-400 mt-3">
          Если не нужна изоляция — можно убрать <code className="text-purple-400">Network=</code> из .container файла.
        </p>
      </div>
    </div>
  )
}

function ServiceTab() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
          <i className="fas fa-cogs text-orange-400"></i>
          Сгенерированный Systemd Service
        </h3>
        <p className="text-gray-400 mb-4">
          Quadlet автоматически генерирует этот файл из .container конфигурации. 
          Не нужно создавать его вручную!
        </p>
      </div>

      <CodeBlock code={`# ~/.config/systemd/user/mumble-web-proxy.service
# АВТОМАТИЧЕСКИ СГЕНЕРИРОВАН Quadlet из mumble-web-proxy.container

[Unit]
Description=Mumble to WebSocket+WebRTC Proxy
Documentation=https://github.com/ZwerG-MaX/mumble-web-proxy
After=network-online.target
Wants=network-online.target

[Service]
Environment=PODMAN_SYSTEMD_UNIT=%n
Restart=on-failure
TimeoutStartSec=900

ExecStartPre=/usr/bin/podman rm -f -i %N || true
ExecStart=/usr/bin/podman run \\
    --name %N \\
    --cidfile=%t/%N.cid \\
    --replace \\
    --rm \\
    --cgroups=split \\
    --sdnotify=conmon \\
    -d \\
    --publish 64737:64737 \\
    --publish 20000-21000:20000-21000/udp \\
    --volume mumble-web-proxy-config:/etc/mumble-web-proxy:ro \\
    --memory=256m \\
    --cpus=0.5 \\
    --memory-swap=512m \\
    --read-only \\
    --security-opt=label=type:container_runtime_t \\
    --no-new-privileges \\
    --network mumble-web-proxy-network \\
    --env RUST_LOG=info \\
    docker.io/zwergmax/mumble-web-proxy:latest \\
    /usr/local/bin/mumble-web-proxy --config /etc/mumble-web-proxy/config.toml

ExecStop=/usr/bin/podman stop --ignore -t 10 %N

[Install]
WantedBy=default.target`} />

      <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
        <h4 className="font-semibold text-orange-400 mb-2 flex items-center gap-2">
          <i className="fas fa-magic"></i>
          Магия Quadlet
        </h4>
        <p className="text-sm text-gray-300">
          Вы пишете простой .container файл, а Quadlet генерирует полноценный systemd service 
          с правильными зависимостями, рестартом, логированием и всеми необходимыми опциями Podman.
        </p>
      </div>
    </div>
  )
}

function CommandsTab() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
          <i className="fas fa-terminal text-cyan-400"></i>
          Команды управления
        </h3>
        <p className="text-gray-400 mb-4">
          Все команды для управления сервисом через systemctl.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-semibold mb-2 text-cyan-400">Установка и запуск</h4>
          <CodeBlock code={`# Создать директорию для Quadlet файлов
mkdir -p ~/.config/containers/systemd

# Скопировать файлы
cp mumble-web-proxy.container ~/.config/containers/systemd/
cp mumble-web-proxy.volume ~/.config/containers/systemd/
cp mumble-web-proxy.network ~/.config/containers/systemd/

# Перезагрузить systemd (после изменения файлов)
systemctl --user daemon-reload

# Запустить сервис
systemctl --user start mumble-web-proxy.service

# Включить автозапуск при загрузке
systemctl --user enable mumble-web-proxy.service

# Проверить статус
systemctl --user status mumble-web-proxy.service`} />
        </div>

        <div>
          <h4 className="font-semibold mb-2 text-cyan-400">Мониторинг</h4>
          <CodeBlock code={`# Просмотр логов (в реальном времени)
journalctl --user -u mumble-web-proxy.service -f

# Последние 100 строк логов
journalctl --user -u mumble-web-proxy.service -n 100

# Логи за последний час
journalctl --user -u mumble-web-proxy.service --since "1 hour ago"

# Статистика ресурсов (CPU, память)
podman stats mumble-web-proxy

# Проверить, что контейнер запущен
podman ps | grep mumble-web-proxy`} />
        </div>

        <div>
          <h4 className="font-semibold mb-2 text-cyan-400">Управление</h4>
          <CodeBlock code={`# Остановить сервис
systemctl --user stop mumble-web-proxy.service

# Перезапустить
systemctl --user restart mumble-web-proxy.service

# Отключить автозапуск
systemctl --user disable mumble-web-proxy.service

# Полное удаление (остановить + удалить)
systemctl --user stop mumble-web-proxy.service
systemctl --user disable mumble-web-proxy.service
rm ~/.config/containers/systemd/mumble-web-proxy.*
systemctl --user daemon-reload`} />
        </div>

        <div>
          <h4 className="font-semibold mb-2 text-cyan-400">Отладка</h4>
          <CodeBlock code={`# Посмотреть сгенерированный systemd unit
systemctl --user cat mumble-web-proxy.service

# Проверить конфигурацию контейнера
podman inspect mumble-web-proxy

# Войти в контейнер (если запущен)
podman exec -it mumble-web-proxy /bin/sh

# Проверить логи Podman
podman logs mumble-web-proxy

# Проверить зависимости
systemctl --user list-dependencies mumble-web-proxy.service`} />
        </div>

        <div>
          <h4 className="font-semibold mb-2 text-cyan-400">Обновление образа</h4>
          <CodeBlock code={`# Скачать новую версию образа
podman pull docker.io/zwergmax/mumble-web-proxy:latest

# Перезапустить сервис с новым образом
systemctl --user restart mumble-web-proxy.service

# Очистить старые образы
podman image prune -f`} />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
        <h4 className="font-semibold text-cyan-400 mb-2 flex items-center gap-2">
          <i className="fas fa-lightbulb"></i>
          Подсказка
        </h4>
        <p className="text-sm text-gray-300">
          Используйте <code className="text-cyan-400">--user</code> флаг для управления сервисами от имени пользователя. 
          Для системных сервисов (root) используйте <code className="text-cyan-400">sudo systemctl</code> без <code className="text-cyan-400">--user</code>.
        </p>
      </div>
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre className="p-4 rounded-xl bg-gray-950 border border-gray-800 overflow-x-auto text-sm font-mono text-gray-300">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
        title="Copy"
      >
        <i className={`fas ${copied ? 'fa-check text-green-400' : 'fa-copy'} text-xs`}></i>
      </button>
    </div>
  )
}
