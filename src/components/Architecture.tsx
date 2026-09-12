export default function Architecture() {
  return (
    <section id="architecture" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Как это <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">работает</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Прокси-сервер выступает мостом между нативным Mumble-протоколом и веб-стандартами
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Architecture diagram */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 sm:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              {/* Browser */}
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center mb-4">
                  <i className="fas fa-globe text-blue-400 text-3xl"></i>
                </div>
                <h3 className="font-semibold text-lg mb-1">Браузер</h3>
                <p className="text-sm text-gray-500">mumble-web клиент</p>
                <div className="mt-3 flex flex-col gap-1 text-xs">
                  <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">WebSocket (control)</span>
                  <span className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">WebRTC (voice)</span>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center gap-4">
                <div className="hidden md:flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-12 bg-gradient-to-r from-blue-500 to-violet-500"></div>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center">
                      <i className="fas fa-exchange-alt text-violet-400 text-xl"></i>
                    </div>
                    <div className="h-0.5 w-12 bg-gradient-to-r from-violet-500 to-green-500"></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-3 font-medium">mumble-web-proxy</p>
                  <p className="text-xs text-gray-600">Rust + Tokio</p>
                </div>
                <div className="md:hidden flex flex-col items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-0.5 h-8 bg-gradient-to-b from-blue-500 to-violet-500"></div>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center">
                      <i className="fas fa-exchange-alt text-violet-400 text-lg"></i>
                    </div>
                    <div className="w-0.5 h-8 bg-gradient-to-b from-violet-500 to-green-500"></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2 font-medium">mumble-web-proxy</p>
                </div>
              </div>

              {/* Server */}
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center mb-4">
                  <i className="fas fa-server text-green-400 text-3xl"></i>
                </div>
                <h3 className="font-semibold text-lg mb-1">Mumble Server</h3>
                <p className="text-sm text-gray-500">Murmur / Mumble 1.4+</p>
                <div className="mt-3 flex flex-col gap-1 text-xs">
                  <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">TCP (control)</span>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">UDP (voice)</span>
                </div>
              </div>
            </div>

            {/* Protocol mapping */}
            <div className="mt-12 pt-8 border-t border-gray-800">
              <h4 className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">Маппинг протоколов</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-800/50">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <i className="fas fa-arrows-left-right text-blue-400"></i>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Управление</p>
                    <p className="text-xs text-gray-500">TCP → WebSocket (ws:// / wss://)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-800/50">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <i className="fas fa-microphone-lines text-cyan-400"></i>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Голос</p>
                    <p className="text-xs text-gray-500">UDP → WebRTC (ICE/STUN/TURN)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-800/50">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <i className="fas fa-lock text-purple-400"></i>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Безопасность</p>
                    <p className="text-xs text-gray-500">TLS через обратный прокси</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-800/50">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <i className="fas fa-shuffle text-amber-400"></i>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Кодеки</p>
                    <p className="text-xs text-gray-500">Opus, CELT, Speex transcoding</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
