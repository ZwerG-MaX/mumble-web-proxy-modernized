import { useState, useMemo } from 'react'

interface CodeViewerProps {
  oldCode: string
  newCode: string
  fileName: string
  viewMode: 'split' | 'old' | 'new'
}

export default function CodeViewer({ oldCode, newCode, fileName, viewMode }: CodeViewerProps) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* File header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-800 bg-gray-900/80">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-sm font-mono text-gray-400">{fileName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-red-400">
            <i className="fas fa-minus-circle mr-1"></i>
            {oldCode.split('\n').length} lines
          </span>
          <span className="text-green-400">
            <i className="fas fa-plus-circle mr-1"></i>
            {newCode.split('\n').length} lines
          </span>
        </div>
      </div>

      {/* Code content */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">
          <CodePanel
            code={oldCode}
            label="Original (2018-2021)"
            variant="old"
          />
          <CodePanel
            code={newCode}
            label="Modernized (2024-2026)"
            variant="new"
          />
        </div>
      ) : viewMode === 'old' ? (
        <CodePanel code={oldCode} label="Original Code" variant="old" />
      ) : (
        <CodePanel code={newCode} label="Modernized Code" variant="new" />
      )}
    </div>
  )
}

interface CodePanelProps {
  code: string
  label: string
  variant: 'old' | 'new'
}

function CodePanel({ code, label, variant }: CodePanelProps) {
  const [copied, setCopied] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const lines = useMemo(() => code.split('\n'), [code])

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const highlightLine = (line: string) => {
    if (!searchTerm) return line
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi')
    const parts = line.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${
        variant === 'old' 
          ? 'bg-red-500/5 border-red-500/20' 
          : 'bg-green-500/5 border-green-500/20'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${variant === 'old' ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <span className={`text-xs font-medium ${variant === 'old' ? 'text-red-400' : 'text-green-400'}`}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            title="Search"
          >
            <i className="fas fa-search text-xs"></i>
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            title="Copy code"
          >
            <i className={`fas ${copied ? 'fa-check text-green-400' : 'fa-copy'} text-xs`}></i>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/80">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search in code..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>
      )}

      {/* Code content */}
      <div className="overflow-auto max-h-[600px]">
        <pre className="p-0 text-sm font-mono leading-relaxed">
          <code>
            {lines.map((line, index) => (
              <div
                key={index}
                className={`flex hover:bg-white/[0.02] ${
                  searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase())
                    ? 'bg-yellow-500/5'
                    : ''
                }`}
              >
                <span className="select-none w-12 shrink-0 text-right pr-4 text-gray-600 text-xs leading-relaxed py-0.5 border-r border-gray-800/50">
                  {index + 1}
                </span>
                <span className="pl-4 pr-4 py-0.5 whitespace-pre text-gray-300 overflow-x-auto">
                  {highlightLine(line)}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
