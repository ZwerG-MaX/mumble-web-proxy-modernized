import { useState } from 'react'

export default function ModernizationStatus() {
  const [activeTab, setActiveTab] = useState<'problems' | 'solutions' | 'progress'>('problems')

  return (
    <section className="py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Статус <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">модернизации</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Анализ проблем совместимости и альтернативные решения
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 justify-center">
          <button
            onClick={() => setActiveTab('problems')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'problems'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <i className="fas fa-exclamation-triangle mr-2"></i>
            Проблемы
          </button>
          <button
            onClick={() => setActiveTab('solutions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'solutions'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <i className="fas fa-lightbulb mr-2"></i>
            Решения
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'progress'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <i className="fas fa-tasks mr-2"></i>
            Прогресс
          </button>
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
          {activeTab === 'problems' && <ProblemsTab />}
          {activeTab === 'solutions' && <SolutionsTab />}
          {activeTab === 'progress' && <ProgressTab />}
        </div>
      </div>
    </section>
  )
}

function ProblemsTab() {
  const problems = [
    {
      repo: 'mumble-protocol',
      url: 'https://github.com/Johni0702/rust-mumble-protocol',
      issues: [
        { lib: 'protobuf', current: '2.x', required: '3.x', reason: 'Устарел, не поддерживает edition 2021' },
        { lib: 'tokio-util', current: '0.6', required: '0.7', reason: 'Несовместим с современным tokio' },
        { lib: 'edition', current: '2018', required: '2021', reason: 'Устаревшая редакция Rust' },
      ],
    },
    {
      repo: 'rtp',
      url: 'https://github.com/Johni0702/rtp',
      issues: [
        { lib: 'trackable', current: '0.1', required: '—', reason: 'Устарел, не поддерживается' },
        { lib: 'handy_async', current: '0.2', required: '—', reason: 'Устарел, не поддерживается' },
        { lib: 'rust-crypto', current: '0.2', required: '—', reason: 'Не поддерживается, уязвимости' },
        { lib: 'num', current: '0.1', required: '0.4', reason: 'Устарел' },
      ],
    },
    {
      repo: 'libnice',
      url: 'https://github.com/Johni0702/rust-libnice',
      issues: [
        { lib: 'glib', current: '0.10', required: '0.18', reason: 'Устарел' },
        { lib: 'edition', current: '2018', required: '2021', reason: 'Устаревшая редакция Rust' },
      ],
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
        <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
          <i className="fas fa-exclamation-circle"></i>
          Критические проблемы совместимости
        </h3>
        <p className="text-sm text-gray-300">
          Оригинальные репозитории Johni0702 используют устаревшие зависимости, которые несовместимы 
          с современным Rust 1.88+ и edition 2021/2024.
        </p>
      </div>

      {problems.map((problem, i) => (
        <div key={i} className="p-4 rounded-xl bg-gray-800/50">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <i className="fab fa-github text-gray-400"></i>
            <a href={problem.url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">
              {problem.repo}
            </a>
          </h4>
          <div className="space-y-2">
            {problem.issues.map((issue, j) => (
              <div key={j} className="flex items-start gap-3 text-sm">
                <code className="text-amber-400 shrink-0">{issue.lib}</code>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                    {issue.current}
                  </span>
                  <i className="fas fa-arrow-right text-gray-600"></i>
                  <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                    {issue.required}
                  </span>
                </div>
                <span className="text-gray-500 text-xs">{issue.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
          <i className="fas fa-clock"></i>
          Оценка времени на полную переделку
        </h4>
        <ul className="space-y-1 text-sm text-gray-300">
          <li>• Миграция mumble-protocol на protobuf 3: <strong className="text-white">40-60 часов</strong></li>
          <li>• Создание современной реализации RTP: <strong className="text-white">80-120 часов</strong></li>
          <li>• Обновление libnice bindings: <strong className="text-white">20-30 часов</strong></li>
          <li>• Интеграционное тестирование: <strong className="text-white">40-60 часов</strong></li>
          <li className="pt-2 border-t border-gray-700 mt-2">
            <strong className="text-amber-400">Итого: 180-270 часов (4-7 недель)</strong>
          </li>
        </ul>
      </div>
    </div>
  )
}

function SolutionsTab() {
  const solutions = [
    {
      title: 'Использовать оригинальный код с Rust 1.75',
      difficulty: 'Легко',
      time: '5 минут',
      recommended: true,
      description: 'Самый надёжный способ - использовать оригинальный код с фиксированной версией Rust',
      code: `# Клонировать оригинальный репозиторий
git clone https://github.com/Johni0702/mumble-web-proxy.git
cd mumble-web-proxy

# Использовать Rust 1.75
rustup default 1.75.0

# Собрать
cargo build --release`,
    },
    {
      title: 'Docker с фиксированной версией Rust',
      difficulty: 'Легко',
      time: '10 минут',
      recommended: true,
      description: 'Использовать Docker образ с Rust 1.75 для изоляции от системных зависимостей',
      code: `# Собрать Docker образ
docker build -t mumble-web-proxy:latest .

# Запустить
docker run -d \\
  --name mumble-web-proxy \\
  -p 64737:64737 \\
  -p 20000-21000:20000-21000/udp \\
  mumble-web-proxy:latest \\
  --listen-ws 64737 \\
  --server mumble.example.com:64738`,
    },
    {
      title: 'Ждать обновления оригинального репозитория',
      difficulty: 'Пассивно',
      time: 'Неизвестно',
      recommended: false,
      description: 'Следить за обновлениями в оригинальных репозиториях Johni0702',
      code: `# Подписаться на уведомления
# https://github.com/Johni0702/mumble-web-proxy
# https://github.com/Johni0702/rust-mumble-protocol
# https://github.com/Johni0702/rtp`,
    },
    {
      title: 'Внести вклад в модернизацию',
      difficulty: 'Сложно',
      time: '180-270 часов',
      recommended: false,
      description: 'Помочь автору с модернизацией зависимостей через Pull Requests',
      code: `# Форкнуть репозитории
# Обновить зависимости
# Исправить проблемы совместимости
# Протестировать
# Создать Pull Request`,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
        <h3 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
          <i className="fas fa-check-circle"></i>
          Рекомендуемые решения
        </h3>
        <p className="text-sm text-gray-300">
          Выберите одно из решений в зависимости от ваших требований и доступного времени.
        </p>
      </div>

      {solutions.map((solution, i) => (
        <div
          key={i}
          className={`p-4 rounded-xl border ${
            solution.recommended
              ? 'bg-green-500/5 border-green-500/30'
              : 'bg-gray-800/50 border-gray-700'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <h4 className="font-semibold flex items-center gap-2">
              {solution.recommended && (
                <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs">
                  Рекомендуется
                </span>
              )}
              {solution.title}
            </h4>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-gray-700 text-gray-300">
                <i className="fas fa-signal mr-1"></i>
                {solution.difficulty}
              </span>
              <span className="px-2 py-1 rounded bg-gray-700 text-gray-300">
                <i className="fas fa-clock mr-1"></i>
                {solution.time}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-3">{solution.description}</p>
          <pre className="p-3 rounded-lg bg-gray-950 border border-gray-800 overflow-x-auto text-xs font-mono text-gray-300">
            <code>{solution.code}</code>
          </pre>
        </div>
      ))}
    </div>
  )
}

function ProgressTab() {
  const tasks = [
    {
      category: 'Веб-интерфейс (React + TypeScript)',
      status: 'complete',
      items: [
        { name: 'Обзор изменений в коде', done: true },
        { name: 'Split view для сравнения кода', done: true },
        { name: 'Инструкция по загрузке в GitHub', done: true },
        { name: 'Инструкция по Podman Quadlet', done: true },
        { name: 'Поиск по коду', done: true },
        { name: 'Копирование в буфер обмена', done: true },
      ],
    },
    {
      category: 'Rust backend (модернизация)',
      status: 'partial',
      items: [
        { name: 'Обновлён Cargo.toml', done: true },
        { name: 'Создана структура проекта', done: true },
        { name: 'Подготовлен Dockerfile', done: true },
        { name: 'Подготовлена Quadlet конфигурация', done: true },
        { name: 'Переделка mumble-protocol на protobuf 3', done: false },
        { name: 'Создание современной реализации RTP', done: false },
        { name: 'Обновление libnice bindings', done: false },
        { name: 'Интеграционное тестирование', done: false },
      ],
    },
    {
      category: 'Документация',
      status: 'complete',
      items: [
        { name: 'README.md с инструкциями', done: true },
        { name: 'MODERNIZATION_STATUS.md', done: true },
        { name: 'Описание проблем совместимости', done: true },
        { name: 'Альтернативные решения', done: true },
      ],
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <h3 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          Текущий статус проекта
        </h3>
        <p className="text-sm text-gray-300">
          Веб-интерфейс полностью готов. Rust backend частично реализован, но требует доработки 
          для полной совместимости с современным Rust.
        </p>
      </div>

      {tasks.map((task, i) => (
        <div key={i} className="p-4 rounded-xl bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">{task.category}</h4>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                task.status === 'complete'
                  ? 'bg-green-500/20 text-green-400'
                  : task.status === 'partial'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {task.status === 'complete' && '✓ Завершено'}
              {task.status === 'partial' && '◐ Частично'}
              {task.status === 'pending' && '○ Не начато'}
            </span>
          </div>
          <div className="space-y-2">
            {task.items.map((item, j) => (
              <div key={j} className="flex items-center gap-3 text-sm">
                <i
                  className={`fas ${
                    item.done ? 'fa-check-circle text-green-400' : 'fa-circle text-gray-600'
                  }`}
                ></i>
                <span className={item.done ? 'text-gray-300' : 'text-gray-500'}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
        <h4 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
          <i className="fas fa-rocket"></i>
          Следующие шаги
        </h4>
        <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
          <li>Используйте оригинальный репозиторий с Rust 1.75 или Docker</li>
          <li>Следите за обновлениями в репозиториях Johni0702</li>
          <li>При желании, внесите вклад в модернизацию через Pull Requests</li>
          <li>Используйте веб-интерфейс для изучения кода и инструкций</li>
        </ol>
      </div>
    </div>
  )
}
