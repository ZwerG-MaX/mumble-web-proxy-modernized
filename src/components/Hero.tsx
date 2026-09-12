export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-8">
          <i className="fas fa-bolt"></i>
          <span>Open Source • Rust • WebRTC</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6">
          <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
            mumble-web-proxy
          </span>
        </h1>

        <p className="text-xl sm:text-2xl text-gray-400 max-w-3xl mx-auto mb-8 leading-relaxed">
          Мост между Mumble-сервером и браузером. 
          <span className="text-gray-300 font-medium"> TCP → WebSocket</span>, 
          <span className="text-gray-300 font-medium"> UDP → WebRTC</span>.
          <br className="hidden sm:block" />
          Голосовая связь через веб — без установки клиентов.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a
            href="#installation"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-lg shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-105 transition-all duration-200"
          >
            <i className="fas fa-rocket mr-2"></i>
            Начать
          </a>
          <a
            href="https://github.com/Johni0702/mumble-web-proxy"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-xl border border-gray-700 text-gray-300 font-semibold text-lg hover:border-gray-500 hover:bg-white/5 transition-all duration-200"
          >
            <i className="fab fa-github mr-2"></i>
            GitHub
          </a>
        </div>

        {/* Terminal preview */}
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-900/80 backdrop-blur-sm shadow-2xl shadow-black/50">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              <span className="ml-2 text-xs text-gray-500 font-mono">terminal</span>
            </div>
            <div className="p-6 text-left font-mono text-sm">
              <div className="text-gray-500">$ cargo install mumble-web-proxy</div>
              <div className="text-green-400 mt-1">✓ Compiling mumble-web-proxy v0.5.0</div>
              <div className="text-green-400">✓ Finished release [optimized] target(s)</div>
              <div className="text-gray-500 mt-3">$ mumble-web-proxy --listen-ws 64737 --server mumble:64738</div>
              <div className="text-blue-400 mt-1">→ WebSocket listening on :64737</div>
              <div className="text-blue-400">→ Connected to Mumble server mumble:64738</div>
              <div className="text-purple-400">→ ICE/STUN ready for WebRTC connections</div>
              <div className="flex items-center mt-2">
                <span className="text-gray-500">$ </span>
                <span className="w-2 h-5 bg-violet-400 animate-pulse ml-0.5"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <i className="fas fa-chevron-down text-gray-600 text-xl"></i>
      </div>
    </section>
  )
}
