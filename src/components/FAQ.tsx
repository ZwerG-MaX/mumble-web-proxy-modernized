import { useState } from 'react'

export default function FAQ() {
  const faqs = [
    {
      question: 'Зачем нужен mumble-web-proxy?',
      answer: 'Mumble использует TCP для управления и UDP для голоса. Браузеры не могут напрямую работать с UDP. Этот прокси конвертирует UDP в WebRTC, позволяя подключаться к Mumble-серверам прямо из браузера без установки клиента.',
    },
    {
      question: 'Какие Mumble-серверы поддерживаются?',
      answer: 'Поддерживаются все версии Mumble/Murmur серверов: 1.2.x, 1.3.x и 1.4.x. Прокси совместим со стандартным Murmur-сервером без каких-либо модификаций.',
    },
    {
      question: 'Нужен ли TURN-сервер?',
      answer: 'В большинстве случаев — нет. WebRTC пытается установить прямое P2P-соединение через ICE. TURN нужен только если оба клиента за строгими NAT (symmetric NAT). Для типичного использования достаточно STUN.',
    },
    {
      question: 'Какая задержка звука?',
      answer: 'Дополнительная задержка от прокси — менее 1 мс (Rust + Tokio). Основная задержка определяется сетевым путём и WebRTC-буферизацией. В типичном сценарии общая задержка 20-50 мс, что сопоставимо с нативным Mumble-клиентом.',
    },
    {
      question: 'Можно ли использовать без mumble-web?',
      answer: 'Да! Прокси предоставляет стандартный WebSocket API. Вы можете написать свой клиент на любом языке/фреймворке. Протокол описан в репозитории mumble-web (ветка webrtc).',
    },
    {
      question: 'Поддерживается ли шифрование голоса?',
      answer: 'WebRTC по умолчанию шифрует весь трафик через DTLS-SRTP. Управляющий канал шифруется через TLS (при использовании WSS через обратный прокси). Таким образом, весь трафик зашифрован end-to-end.',
    },
    {
      question: 'Как обновить с предыдущей версии?',
      answer: 'Просто пересоберите из последней версии master-ветки. Протокол между mumble-web-proxy и mumble-web может меняться (он ещё не стабилизирован), поэтому обновляйте оба компонента одновременно.',
    },
    {
      question: 'Работает ли с Mumble 1.5+?',
      answer: 'Mumble 1.5 добавил нативную поддержку WebSocket, что снижает потребность в этом прокси для новых развёртываний. Однако для совместимости со старыми серверами 1.2-1.4 прокси остаётся актуальным.',
    },
  ]

  return (
    <section id="faq" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Часто задаваемые <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">вопросы</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Ответы на популярные вопросы о проекте
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <FAQItem key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-xl border transition-all duration-200 ${
      open 
        ? 'border-violet-500/30 bg-violet-500/5' 
        : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
    }`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <span className="font-medium pr-4">{question}</span>
        <i className={`fas fa-chevron-down text-sm transition-transform duration-200 shrink-0 ${
          open ? 'rotate-180 text-violet-400' : 'text-gray-500'
        }`}></i>
      </button>
      {open && (
        <div className="px-5 pb-5 -mt-1">
          <p className="text-gray-400 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}
