import { useState, useEffect, useRef, useMemo } from 'react'
import { useAppStore, type Work } from '../stores/appStore'
import * as api from '../lib/api'
import * as data from '../lib/data'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6']

type NoteItem = { id: string; title: string; content: string; createdAt: string; sourceLabel?: string; sourceKey: string }

function loadNotes(key: string): NoteItem[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

function saveNotes(key: string, notes: NoteItem[]) {
  localStorage.setItem(key, JSON.stringify(notes))
}

function loadMeetingNotes(meetingId: string, meetingTitle: string): NoteItem[] {
  return loadNotes(`meeting-notes-${meetingId}`).map((n) => ({
    ...n, sourceLabel: `组会: ${meetingTitle}`, sourceKey: `meeting-notes-${meetingId}`,
  }))
}

export default function WorksPage() {
  const { works, setWorks, meetings, setMeetings, literature, setLiterature, setSelectedMeetingId, setSelectedLiteratureId, setPage } = useAppStore()
  const [showCreate, setShowCreate] = useState(false)
  const [activeWorkId, setActiveWorkId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<{ id: string; title: string; content: string } | null>(null)
  const [rightTab, setRightTab] = useState<'lit' | 'meetings' | 'notes'>('lit')
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})
  const titleRef = useRef('')
  const contentRef = useRef('')
  const refreshKey = useRef(0)

  useEffect(() => {
    data.loadWorks().then((w) => { setWorks(w); if (w.length && !activeWorkId) setActiveWorkId(w[0].id) })
    const p: Record<string, number> = {}
    works.forEach((w) => { p[w.id] = parseInt(localStorage.getItem(`work-progress-${w.id}`) || '0', 10) })
    setProgressMap(p)
  }, [])

  const activeWork = works.find((w) => w.id === activeWorkId)
  const workMeetings = meetings.filter((m) => (m as Record<string, string>).work_id === activeWorkId)
  const workLiterature = literature.filter((l) => (l as Record<string, string>).work_id === activeWorkId)
  const workNotes = activeWorkId ? loadNotes(`work-notes-${activeWorkId}`) : []
  const allMeetingNotes = activeWorkId ? workMeetings.flatMap((m) => loadMeetingNotes(m.id, m.title)) : []

  function setProgress(workId: string, pct: number) {
    setProgressMap((prev) => ({ ...prev, [workId]: pct }))
    localStorage.setItem(`work-progress-${workId}`, String(pct))
  }

  async function assignMeeting(meetingId: string) {
    if (!activeWorkId) return
    await data.assignMeetingToWork(meetingId, activeWorkId)
    // Update local state so UI reflects change
    setMeetings(meetings.map((m) => m.id === meetingId ? { ...m, work_id: activeWorkId } as typeof m : m))
    refreshKey.current++
  }

  async function assignLiterature(litId: string) {
    if (!activeWorkId) return
    await data.assignLiteratureToWork(litId, activeWorkId)
    setLiterature(literature.map((l) => l.id === litId ? { ...l, work_id: activeWorkId } as typeof l : l))
    refreshKey.current++
  }

  function linkStandaloneNote(noteId: string) {
    if (!activeWorkId) return
    const standalone = loadNotes('standalone-notes')
    const note = standalone.find((n) => n.id === noteId)
    if (!note) return
    // Remove from standalone
    saveNotes('standalone-notes', standalone.filter((n) => n.id !== noteId))
    // Add to work
    const wNotes = loadNotes(`work-notes-${activeWorkId}`)
    wNotes.unshift(note)
    saveNotes(`work-notes-${activeWorkId}`, wNotes)
    refreshKey.current++
  }

  function handleNewNote() {
    if (!activeWorkId) return
    const title = '新笔记'
    const note: NoteItem = { id: crypto.randomUUID(), title, content: activeWork ? `# ${title}\n\n[[${activeWork.name}]]\n\n` : `# ${title}\n\n`, createdAt: new Date().toISOString(), sourceKey: `work-notes-${activeWorkId}` }
    const all = loadNotes(`work-notes-${activeWorkId}`)
    all.unshift(note)
    saveNotes(`work-notes-${activeWorkId}`, all)
    selectNote({ id: note.id, title: note.title, content: note.content })
    refreshKey.current++
  }

  function selectNote(note: { id: string; title: string; content: string }) {
    saveCurrentNote()
    setEditingNote(note)
    titleRef.current = note.title
    contentRef.current = note.content
  }

  function saveCurrentNote() {
    if (!editingNote || !activeWorkId) return
    const all = loadNotes(`work-notes-${activeWorkId}`)
    const idx = all.findIndex((n) => n.id === editingNote.id)
    if (idx >= 0) {
      all[idx] = { ...all[idx], title: titleRef.current, content: contentRef.current }
      saveNotes(`work-notes-${activeWorkId}`, all)
      setEditingNote((prev) => prev ? { ...prev, title: titleRef.current, content: contentRef.current } : null)
    }
  }

  function deleteNote() {
    if (!editingNote || !activeWorkId) return
    const all = loadNotes(`work-notes-${activeWorkId}`)
    saveNotes(`work-notes-${activeWorkId}`, all.filter((n) => n.id !== editingNote.id))
    setEditingNote(null)
    refreshKey.current++
  }

  return (
    <div className="flex h-full">
      {/* Left: Work List sidebar */}
      <div className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">研究工作</h2>
          <span className="text-xs text-zinc-500">{works.length}</span>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {works.map((w) => (
            <button key={w.id} onClick={() => { saveCurrentNote(); setActiveWorkId(w.id); setEditingNote(null) }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs cursor-pointer hover:bg-zinc-800/50 ${
                w.id === activeWorkId ? 'bg-zinc-800 border border-zinc-700' : 'text-zinc-400'
              }`}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                <span className="truncate text-zinc-200 font-medium">{w.name}</span>
              </div>
              {progressMap[w.id] > 0 && (
                <div className="mt-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${progressMap[w.id]}%`, backgroundColor: w.color }} />
                </div>
              )}
            </button>
          ))}
          <button onClick={() => setShowCreate(true)}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 cursor-pointer">+ 新建工作</button>
        </div>
      </div>

      {/* Center: Note Editor */}
      <div className="flex-1 flex flex-col border-r border-zinc-800 overflow-hidden">
        {editingNote ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
              <input value={editingNote.title} onChange={(e) => { titleRef.current = e.target.value; setEditingNote({ ...editingNote, title: e.target.value }) }}
                onBlur={saveCurrentNote} className="flex-1 text-sm font-medium bg-transparent text-zinc-200 focus:outline-none" />
              <button onClick={saveCurrentNote} className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer shrink-0">保存</button>
            </div>
            <textarea value={editingNote.content} onChange={(e) => { contentRef.current = e.target.value; setEditingNote({ ...editingNote, content: e.target.value }) }}
              onBlur={saveCurrentNote}
              className="flex-1 p-4 bg-transparent text-sm text-zinc-300 font-mono leading-relaxed resize-none focus:outline-none"
              placeholder="# 工作笔记...&#10;&#10;用 [[链接]] 引用"
              style={{ fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace" }} />
            <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/30 flex items-center gap-2 shrink-0">
              <button onClick={deleteNote} className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer">删除</button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            <div className="text-center">
              <p className="text-3xl mb-3">📂</p>
              <p>{activeWork ? `工作: ${activeWork.name}` : '选择一个工作'}</p>
              <button onClick={handleNewNote} className="mt-3 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg cursor-pointer">+ 新建笔记</button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel */}
      <RightPanel
        activeWorkId={activeWorkId}
        workMeetings={workMeetings}
        workLiterature={workLiterature}
        workNotes={workNotes}
        allMeetingNotes={allMeetingNotes}
        meetings={meetings}
        literature={literature}
        rightTab={rightTab}
        setRightTab={setRightTab}
        assignMeeting={assignMeeting}
        assignLiterature={assignLiterature}
        linkStandaloneNote={linkStandaloneNote}
        onSelectNote={selectNote}
        handleNewNote={handleNewNote}
        setProgress={(pct) => activeWorkId && setProgress(activeWorkId, pct)}
        progress={activeWorkId ? (progressMap[activeWorkId] || 0) : 0}
        activeWork={activeWork}
        onNavigateMeeting={(id) => { setSelectedMeetingId(id); setPage('meetings') }}
        onNavigateLiterature={(id) => { setSelectedLiteratureId(id); setPage('literature') }}
        key={refreshKey.current}
      />

      {showCreate && <CreateWorkModal onClose={() => setShowCreate(false)} onCreate={async (name, desc) => {
        const id = crypto.randomUUID()
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]
        await data.createWork(id, name, desc, color)
        setWorks([...works, { id, name, description: desc, color }])
        setActiveWorkId(id)
        setShowCreate(false)
      }} />}
    </div>
  )
}

// ---- Right Panel ----

function RightPanel({
  activeWorkId, workMeetings, workLiterature, workNotes, allMeetingNotes,
  meetings, literature, rightTab, setRightTab,
  assignMeeting, assignLiterature, linkStandaloneNote,
  onSelectNote, handleNewNote, setProgress, progress, activeWork,
  onNavigateMeeting, onNavigateLiterature,
}: {
  activeWorkId: string | null
  workMeetings: Array<{ id: string; title: string; date: string }>
  workLiterature: Array<{ id: string; title: string; authors?: string | null }>
  workNotes: NoteItem[]
  allMeetingNotes: NoteItem[]
  meetings: Array<{ id: string; title: string; date: string }>
  literature: Array<{ id: string; title: string; authors?: string | null }>
  rightTab: string; setRightTab: (t: 'lit' | 'meetings' | 'notes') => void
  assignMeeting: (id: string) => void
  assignLiterature: (id: string) => void
  linkStandaloneNote: (id: string) => void
  onSelectNote: (n: { id: string; title: string; content: string }) => void
  handleNewNote: () => void
  setProgress: (p: number) => void
  progress: number
  activeWork: Work | undefined
  onNavigateMeeting: (id: string) => void
  onNavigateLiterature: (id: string) => void
}) {
  const [showAddLit, setShowAddLit] = useState(false)
  const [showAddMeeting, setShowAddMeeting] = useState(false)
  const [showLinkNote, setShowLinkNote] = useState(false)
  const standaloneNotes = useMemo(() => loadNotes('standalone-notes'), [activeWorkId])

  const unlinkedMeetings = meetings.filter((m) => !(m as Record<string, string>).work_id || (m as Record<string, string>).work_id !== activeWorkId)
  const unlinkedLiterature = literature.filter((l) => !(l as Record<string, string>).work_id || (l as Record<string, string>).work_id !== activeWorkId)

  return (
    <div className="w-64 shrink-0 flex flex-col bg-zinc-900/30">
      {/* Progress */}
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-zinc-500">完成度</span>
          <span className="text-xs font-mono text-zinc-400">{progress}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: activeWork?.color || '#3b82f6' }} />
          </div>
          <input type="range" min="0" max="100" value={progress} onChange={(e) => setProgress(parseInt(e.target.value))}
            className="w-16 h-2 accent-blue-500 cursor-pointer" />
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">{activeWork?.description || ''}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <TabBtn active={rightTab === 'lit'} onClick={() => setRightTab('lit')}>文献 ({workLiterature.length})</TabBtn>
        <TabBtn active={rightTab === 'meetings'} onClick={() => setRightTab('meetings')}>组会 ({workMeetings.length})</TabBtn>
        <TabBtn active={rightTab === 'notes'} onClick={() => setRightTab('notes')}>笔记 ({workNotes.length + allMeetingNotes.length})</TabBtn>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {/* Literature Tab */}
        {rightTab === 'lit' && (
          <div className="space-y-1">
            {workLiterature.map((l) => (
              <button key={l.id} onClick={() => onNavigateLiterature(l.id)}
                className="w-full text-left px-2 py-1 hover:bg-zinc-800 rounded text-xs text-zinc-300 truncate cursor-pointer">
                📚 {l.title}
              </button>
            ))}
            {workLiterature.length === 0 && <p className="text-xs text-zinc-600 py-2">暂无文献</p>}
            {showAddLit ? (
              <div className="mt-1 bg-zinc-800 rounded-lg p-1 max-h-32 overflow-y-auto">
                {unlinkedLiterature.length === 0 ? (
                  <p className="text-[10px] text-zinc-500 px-2 py-1">全部已关联</p>
                ) : (
                  unlinkedLiterature.map((l) => (
                    <button key={l.id} onClick={() => { assignLiterature(l.id); setShowAddLit(false) }}
                      className="w-full text-left px-2 py-1 hover:bg-zinc-700 rounded text-xs text-zinc-300 truncate cursor-pointer">{l.title}</button>
                  ))
                )}
              </div>
            ) : (
              <button onClick={() => setShowAddLit(true)} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer mt-1">+ 关联文献</button>
            )}
          </div>
        )}

        {/* Meetings Tab */}
        {rightTab === 'meetings' && (
          <div className="space-y-1">
            {workMeetings.map((m) => (
              <button key={m.id} onClick={() => onNavigateMeeting(m.id)}
                className="w-full text-left px-2 py-1 hover:bg-zinc-800 rounded text-xs text-zinc-300 flex justify-between cursor-pointer">
                <span>📝 {m.title}</span><span className="text-zinc-600">{m.date}</span>
              </button>
            ))}
            {workMeetings.length === 0 && <p className="text-xs text-zinc-600 py-2">暂无组会</p>}
            {showAddMeeting ? (
              <div className="mt-1 bg-zinc-800 rounded-lg p-1 max-h-32 overflow-y-auto">
                {unlinkedMeetings.length === 0 ? (
                  <p className="text-[10px] text-zinc-500 px-2 py-1">全部已关联</p>
                ) : (
                  unlinkedMeetings.map((m) => (
                    <button key={m.id} onClick={() => { assignMeeting(m.id); setShowAddMeeting(false) }}
                      className="w-full text-left px-2 py-1 hover:bg-zinc-700 rounded text-xs text-zinc-300 flex justify-between cursor-pointer">
                      <span>{m.title}</span><span className="text-zinc-600">{m.date}</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <button onClick={() => setShowAddMeeting(true)} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer mt-1">+ 关联组会</button>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {rightTab === 'notes' && (
          <div className="space-y-1">
            <button onClick={handleNewNote} className="w-full text-left px-2 py-1.5 text-xs text-blue-400 hover:bg-zinc-800 rounded cursor-pointer">+ 新建笔记</button>
            {workNotes.map((n) => (
              <button key={n.id} onClick={() => onSelectNote({ id: n.id, title: n.title, content: n.content })}
                className="w-full text-left px-2 py-1.5 hover:bg-zinc-800 rounded text-xs text-zinc-300 truncate cursor-pointer">
                📄 {n.title}
              </button>
            ))}
            {allMeetingNotes.length > 0 && (
              <>
                <div className="text-[10px] text-zinc-600 px-2 pt-2">来自组会</div>
                {allMeetingNotes.map((n) => (
                  <button key={n.id} onClick={() => onSelectNote({ id: n.id, title: n.title, content: n.content })}
                    className="w-full text-left px-2 py-1.5 hover:bg-zinc-800 rounded text-xs text-zinc-400 truncate cursor-pointer">
                    📄 {n.title}
                  </button>
                ))}
              </>
            )}
            {workNotes.length === 0 && allMeetingNotes.length === 0 && <p className="text-xs text-zinc-600 py-2">暂无笔记</p>}

            {/* Link standalone note */}
            {showLinkNote ? (
              <div className="mt-1 bg-zinc-800 rounded-lg p-1 max-h-32 overflow-y-auto">
                {standaloneNotes.length === 0 ? (
                  <p className="text-[10px] text-zinc-500 px-2 py-1">无独立笔记可链接</p>
                ) : (
                  standaloneNotes.map((n) => (
                    <button key={n.id} onClick={() => { linkStandaloneNote(n.id); setShowLinkNote(false) }}
                      className="w-full text-left px-2 py-1 hover:bg-zinc-700 rounded text-xs text-zinc-300 truncate cursor-pointer">{n.title}</button>
                  ))
                )}
              </div>
            ) : (
              <button onClick={() => setShowLinkNote(true)} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer mt-1">+ 链接独立笔记</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} className={`flex-1 py-2 text-xs cursor-pointer ${active ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>{children}</button>
  )
}

// ---- Create Work Modal ----

function CreateWorkModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, desc: string) => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-zinc-100 mb-4">新建研究工作</h3>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="工作名称"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 mb-3 focus:outline-none" />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="描述..." rows={2}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 mb-4 resize-none focus:outline-none" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 cursor-pointer">取消</button>
          <button onClick={() => name.trim() && onCreate(name.trim(), desc.trim())} disabled={!name.trim()}
            className="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white text-sm rounded-lg cursor-pointer">创建</button>
        </div>
      </div>
    </div>
  )
}
