export default function Footer() {
  return (
    <footer className="border-t border-gray-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <i className="fas fa-headset text-white text-sm"></i>
              </div>
              <span className="font-bold text-lg">mumble-web-proxy</span>
            </div>
            <p className="text-gray-400 text-sm max-w-md leading-relaxed">
              Mumble to WebSocket+WebRTC proxy. Позволяет подключаться к Mumble-серверам 
              прямо из браузера. Написан на Rust для максимальной производительности и надёжности.
            </p>
            <div className="flex gap-3 mt-4">
              <a
                href="https://github.com/Johni0702/mumble-web-proxy"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <i className="fab fa-github"></i>
              </a>
              <a
                href="https://wiki.mumble.info"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <i className="fas fa-book"></i>
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-3 text-sm">Ресурсы</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://github.com/Johni0702/mumble-web-proxy" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">GitHub</a></li>
              <li><a href="https://github.com/Johni0702/mumble-web" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">mumble-web клиент</a></li>
              <li><a href="https://wiki.mumble.info" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Mumble Wiki</a></li>
              <li><a href="#installation" className="text-gray-400 hover:text-white transition-colors">Документация</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-sm">Технологии</h4>
            <ul className="space-y-2 text-sm">
              <li><span className="text-gray-400">Rust + Tokio</span></li>
              <li><span className="text-gray-400">WebSocket</span></li>
              <li><span className="text-gray-400">WebRTC / ICE</span></li>
              <li><span className="text-gray-400">Protobuf</span></li>
              <li><span className="text-gray-400">libnice</span></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © 2018–2026 mumble-web-proxy contributors. Licensed under AGPL-3.0.
          </p>
          <p className="text-sm text-gray-600">
            Сделано с <i className="fas fa-heart text-red-500 text-xs"></i> для open-source сообщества
          </p>
        </div>
      </div>
    </footer>
  )
}
