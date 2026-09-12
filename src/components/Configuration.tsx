import { useState } from 'react'

export default function Configuration() {
  const [activeConfig, setActiveConfig] = useState<'cli' | 'toml' | 'nginx' | 'caddy'>('cli')

  const configs = [
    { id: 'cli' as const, label: 'CLI', icon: 'fa-terminal' },
    { id: 'toml' as const, label: 'TOML', icon: 'fa-file-code' },
    { id: 'nginx' as const, label: 'Nginx', icon: 'fa-server' },
    { id: 'caddy' as const, label: 'Caddy', icon: 'fa-shield' },
  ]

  return (
    <section id="configuration" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Конфигурация</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Гибкая настройка через CLI-аргументы или TOML-файл
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 p-1 rounded-xl bg-gray-900/50 border border-gray-800 w-fit mx-auto flex-wrap justify-center">
            {configs.map(config => (
              <button
                key={config.id}
                onClick={() => setActiveConfig(config.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeConfig === config.id
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <i className={`fas ${config.icon} mr-2`}></i>
                {config.label}
              </button>
            ))}
          </div>

          {/* Config content */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
            {activeConfig === 'cli' && (
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold mb-6">Параметры командной строки</h3>
                <div className="space-y-3">
                  {[
                    { flag: '--listen-ws <port>', desc: 'Порт для WebSocket-слушателя', required: true },
                    { flag: '--server <host:port>', desc: 'Адрес Mumble-сервера для подключения', required: true },
                    { flag: '--ice-port-min <port>', desc: 'Минимальный порт для ICE', required: false },
                    { flag: '--ice-port-max <port>', desc: 'Максимальный порт для ICE', required: false },
                    { flag: '--ice-ipv4 <ip>', desc: 'Публичный IPv4 для ICE-кандидатов', required: false },
                    { flag: '--ice-ipv6 <ip>', desc: 'Публичный IPv6 для ICE-кандидатов', required: false },
                    { flag: '--config <file>', desc: 'Путь к TOML-файлу конфигурации', required: false },
                    { flag: '--allow-ping', desc: 'Разрешить ICMP ping-проверки', required: false },
                    { flag: '--bind <ip>', desc: 'IP-адрес для привязки WebSocket', required: false },
                  ].map((param, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800/80 transition-colors">
                      <code className="text-violet-400 font-mono text-sm shrink-0">{param.flag}</code>
                      <span className="text-gray-400 text-sm flex-1">{param.desc}</span>
                      {param.required && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">required</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeConfig === 'toml' && (
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold mb-6">TOML-конфигурация</h3>
                <pre className="p-4 rounded-xl bg-gray-950 border border-gray-800 overflow-x-auto text-sm font-mono text-gray-300">
{`# config.toml

# Порт для WebSocket-слушателя (обязательно)
listen-ws = 64737

# Адрес Mumble-сервера (обязательно)
server = 'mumbleserver:64738'

# Диапазон портов для ICE/WebRTC
ice-port-min = 20000
ice-port-max = 21000

# Публичные IP-адреса (для NAT)
ice-ipv4 = '1.2.3.4'
ice-ipv6 = '2001:db8::1'

# Привязка к определённому интерфейсу
bind = '0.0.0.0'

# Разрешить ping
allow-ping = true`}
                </pre>
                <p className="mt-4 text-sm text-gray-500">
                  <i className="fas fa-info-circle mr-1"></i>
                  Запуск: <code className="text-violet-400">mumble-web-proxy --config config.toml</code>
                </p>
              </div>
            )}

            {activeConfig === 'nginx' && (
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold mb-6">Nginx (TLS-терминация)</h3>
                <pre className="p-4 rounded-xl bg-gray-950 border border-gray-800 overflow-x-auto text-sm font-mono text-gray-300">
{`server {
    listen 443 ssl http2;
    server_name mumble.example.com;

    ssl_certificate     /etc/letsencrypt/live/mumble.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mumble.example.com/privkey.pem;

    location /ws {
        proxy_pass http://127.0.0.1:64737;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}

# Редирект HTTP → HTTPS
server {
    listen 80;
    server_name mumble.example.com;
    return 301 https://$server_name$request_uri;
}`}
                </pre>
              </div>
            )}

            {activeConfig === 'caddy' && (
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold mb-6">Caddy (автоматический TLS)</h3>
                <pre className="p-4 rounded-xl bg-gray-950 border border-gray-800 overflow-x-auto text-sm font-mono text-gray-300">
{`# Caddyfile
mumble.example.com {
    reverse_proxy /ws/* localhost:64737 {
        header_up X-Real-IP {remote_host}
    }
}

# Caddy автоматически obtains TLS-сертификат
# через Let's Encrypt — никаких ручных настроек!`}
                </pre>
                <div className="mt-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <p className="text-sm text-green-400">
                    <i className="fas fa-check-circle mr-2"></i>
                    <strong>Рекомендация 2026:</strong> Caddy — самый простой способ получить TLS. Автоматические сертификаты Let's Encrypt из коробки.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
