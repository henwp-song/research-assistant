import { useState, useEffect, useRef, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { parseWikiLinks } from '../lib/wikilinks'

type Tag = { type: 'meeting' | 'work'; id: string; label: string }
type NoteItem = {
  id: string; title: string; content: string; createdAt: string
  sourceLabel: string; sourceKey: string; sourceId?: string
  tags: Tag[]
}

function scanNotes(
  meetings: Array<{ id: string; title: string }>,
  works: Array<{ id: string; name: string }>,
): NoteItem[] {
  const all: NoteItem[] = []
  const seen = new Set<string>()

  function add(raw: NoteItem[], label: string, key: string, sourceId?: string) {
    raw.forEach((n) => {
      if (seen.has(n.id)) return
      seen.add(n.id)
      all.push({ ...n, sourceLabel: label, sourceKey: key, sourceId, tags: n.tags || [] })
    })
  }

  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i); if (!key) continue
      try {
        const raw = JSON.parse(localStorage.getItem(key) || '[]')
        if (key.startsWith('meeting-notes-')) {
          const mid = key.replace('meeting-notes-', '')
          const m = meetings.find((x) => x.id === mid)
          add(raw, m ? `组会: ${m.title}` : `组会: ${mid.slice(0, 8)}`, key, mid)
        } else if (key.startsWith('work-notes-')) {
          const wid = key.replace('work-notes-', '')
          const w = works.find((x) => x.id === wid)
          add(raw, w ? `工作: ${w.name}` : `工作: ${wid.slice(0, 8)}`, key, wid)
        } else if (key === 'standalone-notes') {
          add(raw, '独立笔记', key)
        }
      } catch {}
    }
  }
  all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return all
}

export default function NotesPage() {
  const { meetings, works, setSelectedMeetingId, setSelectedLiteratureId, setPage } = useAppStore()
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [search, setSearch] = useState('')
  const [showTag, setShowTag] = useState(false)
  const titleRef = useRef('')
  const contentRef = useRef('')

  const allMeetings = meetings as Array<{ id: string; title: string }>
  const allWorks = works as Array<{ id: string; name: string }>

  const allNotes = useMemo(() => scanNotes(allMeetings, allWorks), [meetings, works])

  useEffect(() => { setNotes(allNotes) }, [allNotes])
  useEffect(() => { if (!activeNoteId && notes.length) selectNote(notes[0]) }, [notes])

  const active = notes.find((n) => n.id === activeNoteId)

  function selectNote(n: NoteItem) {
    saveCurrent()
    setActiveNoteId(n.id); setEditTitle(n.title); setEditContent(n.content)
    titleRef.current = n.title; contentRef.current = n.content
  }

  function saveCurrent() {
    if (!active || !activeNoteId) return
    if (titleRef.current === active.title && contentRef.current === active.content) return
    const updated = { ...active, title: titleRef.current, content: contentRef.current }
    persist(active.sourceKey, active.id, updated)
    setNotes((prev) => prev.map((n) => n.id === activeNoteId ? updated : n))
  }

  function persist(key: string, id: string, note: NoteItem) {
    const all = JSON.parse(localStorage.getItem(key) || '[]')
    const idx = all.findIndex((n: { id: string }) => n.id === id)
    if (idx >= 0) { all[idx] = { ...all[idx], title: note.title, content: note.content, tags: note.tags }; localStorage.setItem(key, JSON.stringify(all)) }
  }

  function newNote() {
    saveCurrent()
    const title = `笔记 ${notes.length + 1}`
    const note: NoteItem = { id: crypto.randomUUID(), title, content: '# 新建笔记\n\n', createdAt: new Date().toISOString(), sourceLabel: '独立笔记', sourceKey: 'standalone-notes', tags: [] }
    const all = JSON.parse(localStorage.getItem('standalone-notes') || '[]'); all.unshift({ id: note.id, title: note.title, content: note.content, createdAt: note.createdAt, tags: [] })
    localStorage.setItem('standalone-notes', JSON.stringify(all))
    setNotes((prev) => [note, ...prev]); selectNote(note)
  }

  function delNote() {
    if (!active) return
    const all = JSON.parse(localStorage.getItem(active.sourceKey) || '[]')
    localStorage.setItem(active.sourceKey, JSON.stringify(all.filter((n: { id: string }) => n.id !== active.id)))
    setNotes((prev) => prev.filter((n) => n.id !== active.id)); setActiveNoteId(null)
  }

  function addTag(tag: Tag) {
    if (!active) return
    const exists = active.tags.some((t) => t.id === tag.id)
    if (exists) return
    const updated = { ...active, tags: [...active.tags, tag] }
    persist(active.sourceKey, active.id, updated)
    setNotes((prev) => prev.map((n) => n.id === active.id ? updated : n))
    setShowTag(false)
  }

  function removeTag(tag: Tag) {
    if (!active) return
    const updated = { ...active, tags: active.tags.filter((t) => t.id !== tag.id) }
    persist(active.sourceKey, active.id, updated)
    setNotes((prev) => prev.map((n) => n.id === active.id ? updated : n))
  }

  function navLink(link: { target: string; entityType?: string; entityId?: string }) {
    if (link.entityType === 'meeting' && link.entityId) { setSelectedMeetingId(link.entityId); setPage('meetings') }
    else if (link.entityType === 'literature' && link.entityId) { setSelectedLiteratureId(link.entityId); setPage('literature') }
    else if (link.entityType === 'work') { setPage('works') }
    else if (link.entityType === 'note' && link.entityId) { const t = notes.find((n) => n.id === link.entityId); if (t) selectNote(t) }
  }

  function navTag(tag: Tag) {
    if (tag.type === 'meeting') { setSelectedMeetingId(tag.id); setPage('meetings') }
    else if (tag.type === 'work') { setPage('works') }
  }

  const wikiLinks = useMemo(() => parseWikiLinks(editContent), [editContent])
  const backlinks = useMemo(() => {
    if (!active) return []
    return notes.filter((n) => n.id !== active.id && parseWikiLinks(n.content).some((l) => l.target === active.title))
  }, [active?.title, notes])

  // Flat time-sorted list filtered by search
  const filtered = search
    ? notes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
    : notes

  return (
    <div className="flex h-full">
      {/* Left: Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {active ? (
          <>
            {/* Title + source */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0 flex-wrap">
              <input value={editTitle} onChange={(e) => { setEditTitle(e.target.value); titleRef.current = e.target.value }}
                onBlur={saveCurrent} className="flex-1 text-sm font-medium bg-transparent text-zinc-200 focus:outline-none min-w-0" />
              <button onClick={() => navTag({ type: active.sourceLabel.startsWith('组会') ? 'meeting' : active.sourceLabel.startsWith('工作') ? 'work' : 'meeting', id: active.sourceId || '', label: '' })}
                className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded shrink-0 cursor-pointer hover:text-zinc-400">
                {active.sourceLabel}
              </button>
              <button onClick={saveCurrent} className="text-[10px] text-zinc-500 hover:text-zinc-300 shrink-0">保存</button>
            </div>

            {/* Tags */}
            {active.tags.length > 0 && (
              <div className="flex items-center gap-1 px-4 py-1.5 border-b border-zinc-800 bg-zinc-900/30">
                {active.tags.map((t) => (
                  <button key={t.id} onClick={() => navTag(t)}
                    className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-500/20 flex items-center gap-1 group">
                    {t.label}
                    <span onClick={(e) => { e.stopPropagation(); removeTag(t) }}
                      className="text-zinc-600 group-hover:text-red-400">×</span>
                  </button>
                ))}
              </div>
            )}

            {/* Editor */}
            <textarea value={editContent} onChange={(e) => { setEditContent(e.target.value); contentRef.current = e.target.value }}
              onBlur={saveCurrent}
              className="flex-1 p-4 bg-transparent text-sm text-zinc-300 font-mono leading-relaxed resize-none focus:outline-none"
              placeholder="# 笔记...&#10;&#10;[[链接]]"
              style={{ fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace" }} />

            {/* Footer */}
            <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/30 flex items-center gap-3 shrink-0 flex-wrap">
              {wikiLinks.length > 0 && (
                <span className="text-[10px] text-zinc-600">🔗 {wikiLinks.map((l, i) => (
                  <span key={i} className="text-blue-400 bg-blue-500/10 px-1 rounded cursor-pointer hover:underline mr-1" onClick={() => navLink(l)}>[[{l.target}]]</span>
                ))}</span>
              )}
              <span className="flex-1" />
              {/* Tag button */}
              <div className="relative">
                <button onClick={() => setShowTag(!showTag)} className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer">🏷 添加标签</button>
                {showTag && (
                  <div className="absolute bottom-full right-0 mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 w-40 max-h-48 overflow-y-auto">
                    <div className="text-[10px] text-zinc-600 px-3 py-1">组会</div>
                    {allMeetings.map((m) => (
                      <button key={m.id} onClick={() => addTag({ type: 'meeting', id: m.id, label: `📝 ${m.title}` })}
                        className="w-full text-left px-3 py-1 hover:bg-zinc-700 text-xs text-zinc-300 truncate cursor-pointer">{m.title}</button>
                    ))}
                    <div className="text-[10px] text-zinc-600 px-3 py-1">工作</div>
                    {allWorks.map((w) => (
                      <button key={w.id} onClick={() => addTag({ type: 'work', id: w.id, label: `📂 ${w.name}` })}
                        className="w-full text-left px-3 py-1 hover:bg-zinc-700 text-xs text-zinc-300 truncate cursor-pointer">{w.name}</button>
                    ))}
                  </div>
                )}
              </div>
              {backlinks.length > 0 && (
                <span className="text-[10px] text-zinc-600">被引用: {backlinks.map((b, i) => (
                  <button key={i} onClick={() => selectNote(b)} className="text-blue-400 hover:underline ml-1 cursor-pointer">← {b.title}</button>
                ))}</span>
              )}
              <button onClick={delNote} className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer">删除</button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            <p>选择右侧笔记开始编辑或新建</p>
          </div>
        )}
      </div>

      {/* Right: Note list (flat, time-sorted) */}
      <div className="w-64 shrink-0 border-l border-zinc-800 flex flex-col">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">所有笔记</h2>
          <button onClick={newNote} className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer">+</button>
        </div>
        <div className="p-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索..."
            className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none" />
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          {filtered.map((n) => (
            <button key={n.id} onClick={() => selectNote(n)}
              className={`w-full text-left px-3 py-2 rounded text-xs cursor-pointer ${
                n.id === activeNoteId ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-800/50'
              }`}>
              <div className="truncate">{n.title}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-2">
                <span>{n.sourceLabel}</span>
                <span>{n.createdAt?.slice(0, 10)}</span>
                {n.tags.length > 0 && <span className="text-blue-400">{n.tags.length} 标签</span>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-zinc-600 text-center py-8">无笔记</p>}
        </div>
      </div>
    </div>
  )
}
