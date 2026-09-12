interface ChangesOverviewProps {}

export default function ChangesOverview({}: ChangesOverviewProps) {
  const changes = [
    {
      category: 'Rust Edition',
      from: '2018',
      to: '2021',
      description: 'Обновлён до последней стабильной редакции с улучшенным async/await, pattern matching и trait system',
      icon: 'fa-gear',
      color: 'from-orange-500 to-amber-600',
    },
    {
      category: 'CLI Parsing',
      from: 'argparse',
      to: 'clap v4 (derive)',
      description: 'Заменён устаревший argparse на clap с derive-макросами — автогенерация --help, валидация, типобезопасность',
      icon: 'fa-terminal',
      color: 'from-blue-500 to-cyan-600',
    },
    {
      category: 'TLS Library',
      from: 'native-tls',
      to: 'rustls',
      description: 'Переход на чисто-Rust TLS-стек. Убирает зависимость от OpenSSL на стороне клиента, лучше для кросс-компиляции',
      icon: 'fa-lock',
      color: 'from-green-500 to-emerald-600',
    },
    {
      category: 'Error Handling',
      from: 'Ручные From impl',
      to: 'thiserror + anyhow',
      description: 'Автоматическая генерация Display/From через thiserror для библиотеки + anyhow для приложения',
      icon: 'fa-shield-halved',
      color: 'from-red-500 to-rose-600',
    },
    {
      category: 'Logging',
      from: 'println!',
      to: 'tracing',
      description: 'Структурированное логирование с уровнями (info/debug/trace), фильтрация через RUST_LOG, span-based контекст',
      icon: 'fa-list',
      color: 'from-purple-500 to-violet-600',
    },
    {
      category: 'WebSocket',
      from: 'tungstenite 0.12',
      to: 'tungstenite 0.21',
      description: 'Обновлён до последней версии с исправлениями безопасности и улучшенной совместимостью с RFC 6455',
      icon: 'fa-plug',
      color: 'from-indigo-500 to-blue-600',
    },
    {
      category: 'Async Runtime',
      from: 'tokio 1.0',
      to: 'tokio 1.35',
      description: 'Обновлён до последней версии с улучшенной производительностью, новым I/O driver и multi-thread runtime',
      icon: 'fa-bolt',
      color: 'from-yellow-500 to-orange-600',
    },
    {
      category: 'Config',
      from: 'toml 0.5',
      to: 'toml 0.8',
      description: 'Обновлён парсер TOML с лучшей поддержкой serde, исправлениями ошибок и поддержкой TOML 1.0',
      icon: 'fa-file-code',
      color: 'from-teal-500 to-cyan-600',
    },
    {
      category: 'Code Quality',
      from: 'unwrap() повсюду',
      to: 'proper error handling',
      description: 'Заменены паники на корректную обработку ошибок с контекстом через .context() и map_err()',
      icon: 'fa-check-double',
      color: 'from-pink-500 to-rose-600',
    },
    {
      category: 'Documentation',
      from: 'Минимальная',
      to: 'rustdoc + комментарии',
      description: 'Добавлены doc-комментарии к модулям, функциям и типам. Генерация документации через cargo doc',
      icon: 'fa-book',
      color: 'from-sky-500 to-blue-600',
    },
    {
      category: 'Build Profile',
      from: 'Default',
      to: 'Optimized release',
      description: 'LTO, codegen-units=1, strip — для минимального размера бинарника и максимальной производительности',
      icon: 'fa-rocket',
      color: 'from-violet-500 to-purple-600',
    },
    {
      category: 'Memory Safety',
      from: 'Box::leak',
      to: 'Arc<String>',
      description: 'Убраны утечки памяти через Box::leak. Конфигурация передаётся через Arc для безопасного шаринга',
      icon: 'fa-brain',
      color: 'from-emerald-500 to-green-600',
    },
  ]

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-6 text-center">
        Что <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">изменено</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {changes.map((change, i) => (
          <div
            key={i}
            className="group p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 hover:border-gray-700 transition-all duration-200"
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${change.color} flex items-center justify-center mb-3`}>
              <i className={`fas ${change.icon} text-white text-sm`}></i>
            </div>
            <h3 className="font-semibold text-sm mb-1">{change.category}</h3>
            <div className="flex items-center gap-1 text-xs mb-2">
              <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                {change.from}
              </span>
              <i className="fas fa-arrow-right text-gray-600 text-[10px]"></i>
              <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-mono">
                {change.to}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{change.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
