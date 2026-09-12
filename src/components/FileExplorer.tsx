interface FileExplorerProps {
  files: readonly string[]
  selectedFile: string
  onSelectFile: (file: any) => void
}

export default function FileExplorer({ files, selectedFile, onSelectFile }: FileExplorerProps) {
  const getFileIcon = (filename: string) => {
    if (filename === 'Cargo.toml') return 'fa-cube text-orange-400'
    if (filename.endsWith('.rs')) return 'fa-file-code text-blue-400'
    return 'fa-file text-gray-400'
  }

  const getFileSize = (filename: string) => {
    // Approximate sizes
    const sizes: Record<string, string> = {
      'Cargo.toml': '1.2 KB',
      'src/main.rs': '8.5 KB',
      'src/error.rs': '1.0 KB',
      'src/connection.rs': '15.2 KB',
    }
    return sizes[filename] || '—'
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <i className="fas fa-folder-open text-yellow-400"></i>
        <span className="text-sm font-medium text-gray-400">Project Files</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <button
            key={file}
            onClick={() => onSelectFile(file)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              selectedFile === file
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25 scale-105'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 hover:bg-gray-800'
            }`}
          >
            <i className={`fas ${getFileIcon(file)} text-xs`}></i>
            <span>{file}</span>
            <span className={`text-xs ${selectedFile === file ? 'text-violet-200' : 'text-gray-600'}`}>
              {getFileSize(file)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
