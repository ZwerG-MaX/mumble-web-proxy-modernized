export default function Docker() {
  return (
    <section id="docker" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Docker</span> развёртывание
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Контейнеризация для production-окружений
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Dockerfile */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-800">
              <i className="fab fa-docker text-blue-400 text-xl"></i>
              <h3 className="font-semibold">Dockerfile</h3>
              <span className="ml-auto text-xs text-gray-500 font-mono">multi-stage build</span>
            </div>
            <pre className="p-6 overflow-x-auto text-sm font-mono text-gray-300">
{`# Build stage
FROM rust:1.75-bookworm AS builder

RUN apt-get update && apt-get install -y \\
    libnice-dev \\
    libssl-dev \\
    clang \\
    protobuf-compiler \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \\
    libnice0 \\
    libssl3 \\
    ca-certificates \\
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/mumble-web-proxy /usr/local/bin/

EXPOSE 64737
EXPOSE 20000-21000/udp

ENTRYPOINT ["mumble-web-proxy"]`}
            </pre>
          </div>

          {/* Docker Compose */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-800">
              <i className="fab fa-docker text-cyan-400 text-xl"></i>
              <h3 className="font-semibold">docker-compose.yml</h3>
              <span className="ml-auto text-xs text-gray-500 font-mono">full stack</span>
            </div>
            <pre className="p-6 overflow-x-auto text-sm font-mono text-gray-300">
{`version: '3.8'

services:
  # Mumble сервер
  murmur:
    image: mumblevoip/mumble-server:latest
    ports:
      - "64738:64738"
      - "64738:64738/udp"
    volumes:
      - murmur-data:/data
    environment:
      - MUMBLE_SUPERUSER_PASSWORD=secret
    restart: unless-stopped

  # WebSocket + WebRTC прокси
  mumble-web-proxy:
    build: .
    ports:
      - "64737:64737"
      - "20000-21000:20000-21000/udp"
    command: >
      --listen-ws 64737
      --server murmur:64738
      --ice-port-min 20000
      --ice-port-max 21000
    depends_on:
      - murmur
    restart: unless-stopped

  # Обратный прокси с TLS
  caddy:
    image: caddy:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
    restart: unless-stopped

volumes:
  murmur-data:
  caddy-data:`}
            </pre>
          </div>

          {/* Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
              <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
                <i className="fas fa-triangle-exclamation"></i>
                NAT / Firewall
              </h4>
              <p className="text-sm text-gray-400">
                Если сервер за NAT, обязательно укажите <code className="text-amber-400">--ice-ipv4</code> с публичным IP. 
                Иначе WebRTC не сможет установить соединение.
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
              <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                <i className="fas fa-memory"></i>
                Ресурсы
              </h4>
              <p className="text-sm text-gray-400">
                Прокси потребляет ~10-20 МБ RAM. Нагрузка на CPU минимальна — 
                основная работа делается в ядре Linux (UDP forwarding).
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-green-500/20 bg-green-500/5">
              <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                <i className="fas fa-shield-check"></i>
                Безопасность
              </h4>
              <p className="text-sm text-gray-400">
                Всегда используйте TLS-терминацию через обратный прокси. 
                Никогда не открывайте WebSocket-порт напрямую в интернет.
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5">
              <h4 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
                <i className="fas fa-gauge-high"></i>
                Производительность
              </h4>
              <p className="text-sm text-gray-400">
                Один инстанс легко обслуживает 100+ одновременных подключений. 
                Для масштабирования — запустите несколько прокси за load balancer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
