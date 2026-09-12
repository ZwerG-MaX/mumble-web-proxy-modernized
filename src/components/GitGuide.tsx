import { useState } from 'react'

export default function GitGuide() {
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    {
      title: 'Подготовка окружения',
      icon: 'fa-gear',
      color: 'from-blue-500 to-cyan-600',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400">
            Убедитесь, что у вас установлены необходимые инструменты:
          </p>
          <CodeBlock code={`# Проверка версии git
git --version

# Проверка версии Rust
rustc --version

# Установка Rust (если не установлен)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Настройка git (если ещё не сделано)
git config --global user.name "Ваше Имя"
git config --global user.email "your@email.com"`} />
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <p className="text-sm text-amber-400">
              <i className="fas fa-lightbulb mr-2"></i>
              <strong>Совет:</strong> Используйте SSH-ключи вместо паролей для GitHub:
              <code className="ml-2 text-amber-300">ssh-keygen -t ed25519 -C "your@email.com"</code>
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Клонирование вашего репозитория',
      icon: 'fa-download',
      color: 'from-green-500 to-emerald-600',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400">
            Клонируйте ваш форк репозитория:
          </p>
          <CodeBlock code={`# Через HTTPS
git clone https://github.com/ZwerG-MaX/mumble-web-proxy.git
cd mumble-web-proxy

# Или через SSH (рекомендуется)
git clone git@github.com:ZwerG-MaX/mumble-web-proxy.git
cd mumble-web-proxy`} />
          <p className="text-gray-400">
            Если у вас ещё нет форка — создайте его на GitHub:
          </p>
          <div className="p-4 rounded-xl bg-gray-800/50">
            <ol className="space-y-2 text-sm text-gray-300">
              <li>1. Откройте <a href="https://github.com/Johni0702/mumble-web-proxy" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">оригинальный репозиторий</a></li>
              <li>2. Нажмите кнопку <strong className="text-white">Fork</strong> в правом верхнем углу</li>
              <li>3. Выберите свой аккаунт <strong className="text-white">ZwerG-MaX</strong></li>
              <li>4. Дождитесь завершения форкинга</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      title: 'Создание ветки для изменений',
      icon: 'fa-code-branch',
      color: 'from-purple-500 to-violet-600',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400">
            Создайте новую ветку для ваших изменений (не работайте напрямую в master):
          </p>
          <CodeBlock code={`# Обновите master до последней версии
git checkout master
git pull origin master

# Создайте и переключитесь на новую ветку
git checkout -b modernize/rust-2021

# Или с более описательным именем
git checkout -b feat/modernize-dependencies`} />
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <p className="text-sm text-blue-400">
              <i className="fas fa-info-circle mr-2"></i>
              <strong>Почему ветка?</strong> Это позволяет легко откатить изменения, 
              создать Pull Request и работать над несколькими фичами параллельно.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Копирование обновлённого кода',
      icon: 'fa-copy',
      color: 'from-orange-500 to-amber-600',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400">
            Замените файлы проекта на обновлённые версии:
          </p>
          <CodeBlock code={`# Структура файлов для замены
mumble-web-proxy/
├── Cargo.toml          ← заменить на новую версию
├── Cargo.lock          ← будет обновлён при сборке
└── src/
    ├── main.rs         ← заменить
    ├── error.rs        ← заменить
    └── connection.rs   ← заменить`} />
          <p className="text-gray-400">
            <strong className="text-white">Способ 1:</strong> Вручную скопируйте код из этого сайта в файлы.
          </p>
          <p className="text-gray-400">
            <strong className="text-white">Способ 2:</strong> Скачайте файлы и перезапишите:
          </p>
          <CodeBlock code={`# Пример: скачивание файла через curl
curl -o Cargo.toml https://your-link-to-new-cargo.toml

# Или через wget
wget -O Cargo.toml https://your-link-to-new-cargo.toml`} />
          <p className="text-gray-400">
            <strong className="text-white">Способ 3:</strong> Откройте файлы в редакторе (VS Code, nano, vim) 
            и вставьте код из этого сайта.
          </p>
        </div>
      ),
    },
    {
      title: 'Проверка и сборка',
      icon: 'fa-check-circle',
      color: 'from-teal-500 to-cyan-600',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400">
            Перед коммитом убедитесь, что код компилируется:
          </p>
          <CodeBlock code={`# Проверка синтаксиса
cargo check

# Сборка проекта
cargo build

# Сборка в режиме release
cargo build --release

# Запуск тестов (если есть)
cargo test

# Проверка форматирования
cargo fmt --check

# Линтинг
cargo clippy -- -D warnings`} />
          <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
            <p className="text-sm text-green-400">
              <i className="fas fa-check mr-2"></i>
              <strong>Важно:</strong> Если <code>cargo build</code> проходит без ошибок — 
              можно смело коммитить. Если есть ошибки — исправьте их перед пушем.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Коммит и пуш',
      icon: 'fa-upload',
      color: 'from-pink-500 to-rose-600',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400">
            Закоммитьте изменения и запушьте в GitHub:
          </p>
          <CodeBlock code={`# Посмотрите, какие файлы изменены
git status

# Добавьте все изменённые файлы
git add .

# Или добавьте конкретные файлы
git add Cargo.toml src/main.rs src/error.rs src/connection.rs

# Сделайте коммит с понятным сообщением
git commit -m "Modernize: update to Rust 2021 and latest dependencies

- Upgrade to Rust edition 2021
- Replace argparse with clap v4 (derive macros)
- Switch from native-tls to rustls
- Add thiserror + anyhow for error handling
- Integrate tracing for structured logging
- Update tokio, tungstenite, and other deps
- Improve code quality and documentation"

# Запушьте ветку в ваш репозиторий
git push origin modernize/rust-2021`} />
          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
            <p className="text-sm text-purple-400">
              <i className="fas fa-lightbulb mr-2"></i>
              <strong>Conventional Commits:</strong> Используйте формат 
              <code className="mx-1">type: description</code> — например: 
              <code className="text-purple-300">feat: add rustls support</code> или 
              <code className="text-purple-300">chore: update dependencies</code>
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Создание Pull Request',
      icon: 'fa-code-pull-request',
      color: 'from-indigo-500 to-blue-600',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400">
            Если хотите предложить изменения в оригинальный репозиторий:
          </p>
          <div className="p-4 rounded-xl bg-gray-800/50">
            <ol className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">1</span>
                <span>Откройте <a href="https://github.com/ZwerG-MaX/mumble-web-proxy" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">ваш репозиторий</a> на GitHub</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">2</span>
                <span>GitHub покажет баннер <strong className="text-white">"Compare & pull request"</strong> — нажмите его</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">3</span>
                <span>Заполните title и description (используйте шаблон ниже)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">4</span>
                <span>Нажмите <strong className="text-white">"Create pull request"</strong></span>
              </li>
            </ol>
          </div>
          <p className="text-gray-400">Пример описания PR:</p>
          <CodeBlock code={`## Summary
Modernize the codebase to use current Rust ecosystem (2024-2026).

## Changes
- **Edition**: 2018 → 2021
- **CLI**: argparse → clap v4 with derive macros
- **TLS**: native-tls → rustls (pure Rust)
- **Errors**: manual From → thiserror + anyhow
- **Logging**: println! → tracing with structured logs
- **Dependencies**: updated all to latest stable versions
- **Code quality**: replaced unwrap() with proper error handling

## Testing
- [x] \`cargo check\` passes
- [x] \`cargo build --release\` succeeds
- [x] \`cargo clippy\` clean
- [x] \`cargo fmt\` applied

## Breaking Changes
None for end users. Internal API changes are minimal.`} />
        </div>
      ),
    },
    {
      title: 'Настройка GitHub Actions (опционально)',
      icon: 'fa-robot',
      color: 'from-yellow-500 to-orange-600',
      content: (
        <div className="space-y-4">
          <p className="text-gray-400">
            Добавьте CI/CD для автоматической проверки PR:
          </p>
          <CodeBlock code={`# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

env:
  CARGO_TERM_COLOR: always

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y \\
          libnice-dev libssl-dev clang protobuf-compiler
    
    - name: Install Rust
      uses: dtolnay/rust-toolchain@stable
      with:
        components: rustfmt, clippy
    
    - name: Cache cargo
      uses: actions/cache@v4
      with:
        path: |
          ~/.cargo/bin/
          ~/.cargo/registry/index/
          ~/.cargo/registry/cache/
          ~/.cargo/git/db/
          target/
        key: \${{ runner.os }}-cargo-\${{ hashFiles('**/Cargo.lock') }}
    
    - name: Check formatting
      run: cargo fmt -- --check
    
    - name: Clippy
      run: cargo clippy -- -D warnings
    
    - name: Build
      run: cargo build --verbose
    
    - name: Run tests
      run: cargo test --verbose`} />
          <p className="text-gray-400">
            Создайте файл <code className="text-violet-400">.github/workflows/ci.yml</code> в вашем репозитории.
          </p>
        </div>
      ),
    },
  ]

  return (
    <section className="py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Как <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">залить</span> код в GitHub
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Пошаговая инструкция по загрузке обновлённого кода в{' '}
            <a
              href="https://github.com/ZwerG-MaX/mumble-web-proxy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:underline font-medium"
            >
              ZwerG-MaX/mumble-web-proxy
            </a>
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">
              Шаг {activeStep + 1} из {steps.length}
            </span>
            <span className="text-sm text-gray-400">
              {Math.round(((activeStep + 1) / steps.length) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Steps navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-8">
          {steps.map((step, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`p-3 rounded-xl transition-all duration-200 ${
                activeStep === i
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25 scale-105'
                  : i < activeStep
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-gray-900 border border-gray-800 text-gray-500 hover:border-gray-700'
              }`}
              title={step.title}
            >
              <i className={`fas ${activeStep === i ? step.icon : i < activeStep ? 'fa-check' : step.icon} text-lg`}></i>
            </button>
          ))}
        </div>

        {/* Current step */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
          <div className={`px-6 py-4 border-b border-gray-800 bg-gradient-to-r ${steps[activeStep].color} bg-opacity-10`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <i className={`fas ${steps[activeStep].icon} text-white`}></i>
              </div>
              <div>
                <div className="text-xs text-white/60 uppercase tracking-wider">
                  Шаг {activeStep + 1}
                </div>
                <h3 className="text-xl font-bold text-white">
                  {steps[activeStep].title}
                </h3>
              </div>
            </div>
          </div>
          <div className="p-6">
            {steps[activeStep].content}
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
            disabled={activeStep === 0}
            className="px-6 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Назад
          </button>
          <button
            onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
            disabled={activeStep === steps.length - 1}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Далее
            <i className="fas fa-arrow-right ml-2"></i>
          </button>
        </div>

        {/* Quick reference */}
        <div className="mt-12 p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <i className="fas fa-bolt text-yellow-400"></i>
            Быстрая шпаргалка
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gray-800/50">
              <h4 className="font-semibold text-sm mb-2 text-violet-400">Полный цикл одной командой</h4>
              <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
{`git clone git@github.com:ZwerG-MaX/mumble-web-proxy.git
cd mumble-web-proxy
git checkout -b modernize/rust-2021
# ... замените файлы ...
cargo build
git add .
git commit -m "Modernize: Rust 2021 + latest deps"
git push origin modernize/rust-2021`}
              </pre>
            </div>
            <div className="p-4 rounded-xl bg-gray-800/50">
              <h4 className="font-semibold text-sm mb-2 text-violet-400">Если что-то пошло не так</h4>
              <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
{`# Откатить изменения
git reset --hard HEAD

# Вернуться в master
git checkout master

# Удалить ветку
git branch -D modernize/rust-2021

# Принудительный пуш (осторожно!)
git push -f origin modernize/rust-2021`}
              </pre>
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
        title="Copy"
      >
        <i className={`fas ${copied ? 'fa-check text-green-400' : 'fa-copy'} text-xs`}></i>
      </button>
    </div>
  )
}
