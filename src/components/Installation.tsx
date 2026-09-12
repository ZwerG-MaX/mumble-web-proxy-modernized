import { useState } from 'react'

export default function Installation() {
  const [activeTab, setActiveTab] = useState<'rust' | 'docker' | 'binary'>('rust')

  const tabs = [
    { id: 'rust' as const, label: 'Rust / Cargo', icon: 'fa-gear' },
    { id: 'docker' as const, label: 'Docker', icon: 'fa-box' },
    { id: 'binary' as const, label: 'Из исходников', icon: 'fa-code' },
  ]

  return (
    <section id="installation" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Установка</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Выберите удобный способ установки и запуска
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 p-1 rounded-xl bg-gray-900/50 border border-gray-800 w-fit mx-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <i className={`fas ${tab.icon} mr-2`}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
            {activeTab === 'rust' && (
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <i className="fas fa-gear text-violet-400"></i>
                  Установка через Cargo
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-2">1. Установите зависимости:</p>
                    <CodeBlock code={`# Debian / Ubuntu
sudo apt install libnice-dev libssl-dev clang protobuf-compiler

# Fedora
sudo dnf install libnice-devel openssl-devel clang protobuf-compiler

# macOS
brew install libnice openssl protobuf`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">2. Установите Rust (если ещё не установлен):</p>
                    <CodeBlock code={`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">3. Установите mumble-web-proxy:</p>
                    <CodeBlock code={`cargo install mumble-web-proxy`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">4. Запустите:</p>
                    <CodeBlock code={`mumble-web-proxy --listen-ws 64737 --server mumbleserver:64738`} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'docker' && (
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <i className="fas fa-box text-blue-400"></i>
                  Запуск через Docker
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Быстрый запуск:</p>
                    <CodeBlock code={`docker run -d \\
  --name mumble-web-proxy \\
  -p 64737:64737 \\
  -p 20000-21000:20000-21000/udp \\
  mumble-web-proxy \\
  --listen-ws 64737 \\
  --server mumbleserver:64738 \\
  --ice-port-min 20000 \\
  --ice-port-max 21000`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Или через docker-compose:</p>
                    <CodeBlock code={`# docker-compose.yml
version: '3.8'
services:
  mumble-web-proxy:
    build: .
    ports:
      - "64737:64737"
      - "20000-21000:20000-21000/udp"
    command: >
      --listen-ws 64737
      --server mumbleserver:64738
      --ice-port-min 20000
      --ice-port-max 21000
    restart: unless-stopped`} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'binary' && (
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <i className="fas fa-code text-green-400"></i>
                  Сборка из исходников
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-2">1. Клонируйте репозиторий:</p>
                    <CodeBlock code={`git clone https://github.com/Johni0702/mumble-web-proxy.git
cd mumble-web-proxy`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">2. Установите системные зависимости:</p>
                    <CodeBlock code={`# Debian / Ubuntu
sudo apt install libnice-dev libssl-dev clang protobuf-compiler

# Fedora
sudo dnf install libnice-devel openssl-devel clang protobuf-compiler`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">3. Соберите:</p>
                    <CodeBlock code={`cargo build --release`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">4. Бинарник будет в:</p>
                    <CodeBlock code={`./target/release/mumble-web-proxy`} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Requirements */}
          <div className="mt-8 p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <i className="fas fa-list-check text-amber-400"></i>
              Системные требования
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Rust', version: '1.56+' },
                { label: 'libnice', version: 'development headers' },
                { label: 'OpenSSL', version: 'development headers' },
                { label: 'clang', version: 'любая версия' },
                { label: 'protobuf', version: 'protoc compiler' },
                { label: 'OS', version: 'Linux / macOS' },
              ].map((req, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                  <span className="font-medium text-sm">{req.label}</span>
                  <span className="text-xs text-gray-500 font-mono">{req.version}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
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
      >
        <i className={`fas ${copied ? 'fa-check text-green-400' : 'fa-copy'} text-xs`}></i>
      </button>
    </div>
  )
}
