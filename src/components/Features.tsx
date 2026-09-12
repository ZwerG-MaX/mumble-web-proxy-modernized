export default function Features() {
  const features = [
    {
      icon: 'fa-network-wired',
      title: 'TCP → WebSocket',
      description: 'Прозрачная проксификация управляющего трафика Mumble через WebSocket для безопасной передачи через браузер.',
      color: 'from-violet-500 to-purple-600',
    },
    {
      icon: 'fa-microphone',
      title: 'UDP → WebRTC',
      description: 'Голосовой трафик конвертируется в WebRTC для минимальной задержки и NAT-traversal без дополнительных настроек.',
      color: 'from-blue-500 to-cyan-600',
    },
    {
      icon: 'fa-shield-halved',
      title: 'TLS-терминация',
      description: 'Работает за обратным прокси (nginx, Caddy) для TLS-терминации. Поддержка WSS из коробки.',
      color: 'from-green-500 to-emerald-600',
    },
    {
      icon: 'fa-bolt',
      title: 'Низкая задержка',
      description: 'Написан на Rust с Tokio — асинхронный runtime обеспечивает минимальные накладные расходы на проксирование.',
      color: 'from-amber-500 to-orange-600',
    },
    {
      icon: 'fa-cube',
      title: 'Docker-ready',
      description: 'Готовый Dockerfile для быстрого развёртывания. Один контейнер — полностью рабочий прокси.',
      color: 'from-pink-500 to-rose-600',
    },
    {
      icon: 'fa-code-branch',
      title: 'Совместимость',
      description: 'Поддержка Mumble 1.2/1.3/1.4 серверов. Работает с mumble-web клиентом и любыми WebSocket-клиентами.',
      color: 'from-indigo-500 to-blue-600',
    },
  ]

  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ключевые <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">возможности</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Полный мост между нативным Mumble-протоколом и веб-стандартами
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl border border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 hover:border-gray-700 transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <i className={`fas ${feature.icon} text-white text-lg`}></i>
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
