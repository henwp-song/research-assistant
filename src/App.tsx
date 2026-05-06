import { useState } from 'react'
import { useAppStore } from './stores/appStore'
import MeetingsPage from './pages/MeetingsPage'
import LiteraturePage from './pages/LiteraturePage'
import WorksPage from './pages/WorksPage'
import NotesPage from './pages/NotesPage'
import SettingsPage from './pages/SettingsPage'
import WidgetOverlay from './components/WidgetOverlay'
import * as data from './lib/data'

function App() {
  // Widget mode: render only the overlay
  if (window.location.search.includes('widget')) {
    return (
      <div className="bg-transparent">
        <WidgetOverlay />
      </div>
    )
  }

  const { page, setPage, setSelectedMeetingId, setSelectedLiteratureId } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    type: string
    id: string
    title: string
    summary?: string
    authors?: string
  }>>([])
  const [showSearch, setShowSearch] = useState(false)

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (q.length < 1) {
      setSearchResults([])
      setShowSearch(false)
      return
    }
    const local = await data.searchAll(q)

    // Also search RAG
    let ragResults: Array<{ id: string; title: string; type: string; id2: string }> = []
    try {
      const rag = await (await import('./lib/api')).ragSearch(q, 5)
      ragResults = rag.map((r) => ({
        id: r.source_id || r.id,
        title: r.content.slice(0, 80) + '...',
        type: 'rag',
        id2: r.id,
      }))
    } catch { /* RAG not available */ }

    setSearchResults([
      ...local,
      ...ragResults.map((r) => ({ type: 'rag' as const, id: r.id, title: r.title })),
    ])
    setShowSearch(true)
  }

  function navigateToResult(r: { type: string; id: string }) {
    setShowSearch(false)
    setSearchQuery('')
    if (r.type === 'meeting') {
      setPage('meetings')
      setSelectedMeetingId(r.id)
    } else {
      setPage('literature')
      setSelectedLiteratureId(r.id)
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200">
      {/* Sidebar */}
      <aside className="w-56 border-r border-zinc-800 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h1 className="text-sm font-semibold text-zinc-100">组会科研助手</h1>
          <p className="text-xs text-zinc-500 mt-0.5">MVP v0.1</p>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      navigateToResult(r)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-700 text-xs border-b border-zinc-700/50 last:border-0"
                  >
                    <span className="text-zinc-400 font-mono text-[10px] mr-1">
                      {r.type === 'meeting' ? '📝' : '📚'}
                    </span>
                    <span className="text-zinc-200 line-clamp-1">{r.title}</span>
                    {r.summary && (
                      <span className="block text-zinc-500 text-[11px] line-clamp-1 mt-0.5">
                        {r.summary}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1">
          <SidebarItem active={page === 'meetings'} onClick={() => setPage('meetings')}>
            📝 组会记录
          </SidebarItem>
          <SidebarItem active={page === 'literature'} onClick={() => setPage('literature')}>
            📚 文献管理
          </SidebarItem>
          <SidebarItem active={page === 'works'} onClick={() => setPage('works')}>
            📂 研究工作
          </SidebarItem>
          <SidebarItem active={page === 'notes'} onClick={() => setPage('notes')}>
            ✏️ 笔记
          </SidebarItem>
        </nav>
        <div className="px-3 py-3 border-t border-zinc-800">
          <SidebarItem active={page === 'settings'} onClick={() => setPage('settings')}>
            ⚙️ 设置
          </SidebarItem>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {page === 'meetings' && <MeetingsPage />}
        {page === 'literature' && <LiteraturePage />}
        {page === 'works' && <WorksPage />}
        {page === 'notes' && <NotesPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

function SidebarItem({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
        active
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}

export default App
