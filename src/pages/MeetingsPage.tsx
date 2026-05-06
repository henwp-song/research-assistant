import { useState, useRef, useEffect, useMemo } from 'react'
import { useAppStore, type Meeting } from '../stores/appStore'
import * as api from '../lib/api'
import * as data from '../lib/data'

type Task = {
  id: string
  text: string
  done: boolean
  meetingId: string
  meetingTitle: string
}

// ---- Main Page ----

export default function MeetingsPage() {
  const { meetings, setMeetings, selectedMeetingId, setSelectedMeetingId, asrApiKey, llmApiKey } =
    useAppStore()
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    data.loadMeetings().then(setMeetings)
    data.loadSetting('asr_api_key').then((key) => { if (key) { useAppStore.getState().setAsrApiKey(key); api.setAsrKey(key) } })
    data.loadSetting('llm_api_key').then((key) => { if (key) { useAppStore.getState().setLlmApiKey(key); api.setLlmKey(key) } })
    loadTasks()
  }, [])

  function loadTasks() { try { setTasks(JSON.parse(localStorage.getItem('my-assistant-tasks') || '[]')) } catch {} }

  if (selectedMeetingId) {
    return <MeetingDetail meetingId={selectedMeetingId} onBack={() => { setSelectedMeetingId(null); loadTasks() }} tasks={tasks} setTasks={setTasks} />
  }

  const now = new Date().toISOString().split('T')[0]
  const upcoming = meetings.filter((m) => m.date >= now)
  const past = meetings.filter((m) => m.date < now)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-0.5">
          <TBtn active={tab === 'upcoming'} onClick={() => setTab('upcoming')}>即将到来 ({upcoming.length})</TBtn>
          <TBtn active={tab === 'past'} onClick={() => setTab('past')}>已结束 ({past.length})</TBtn>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg cursor-pointer">+ 新建组会</button>
      </div>

      {tasks.filter((t) => !t.done).length > 0 && (
        <div className="mb-4 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
          <h3 className="text-xs font-medium text-zinc-400 mb-2">📋 所有待办</h3>
          <div className="flex flex-wrap gap-2">
            {tasks.filter((t) => !t.done).slice(0, 6).map((t) => (
              <span key={t.id} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full">{t.text}</span>
            ))}
          </div>
        </div>
      )}

      {(tab === 'upcoming' ? upcoming : past).length === 0 ? (
        <div className="text-center py-20 text-zinc-500"><p className="text-4xl mb-3">📝</p><p>{tab === 'upcoming' ? '暂无即将到来的组会' : '暂无历史组会'}</p></div>
      ) : (
        <div className="space-y-2">
          {(tab === 'upcoming' ? upcoming : past).map((m) => (
            <div key={m.id} onClick={() => setSelectedMeetingId(m.id)}
              className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-700 flex items-center justify-between">
              <div className="min-w-0"><h3 className="text-sm font-medium text-zinc-200">{m.title}</h3></div>
              <div className="text-right ml-4 shrink-0"><div className="text-sm font-mono text-blue-400">{m.date}</div></div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={(m) => { setMeetings([m, ...meetings]); setSelectedMeetingId(m.id); setShowCreate(false) }} />}
    </div>
  )
}

function TBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${active ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>{children}</button>
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (m: Meeting) => void }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  async function submit() {
    if (!title.trim() || !date) return
    const id = crypto.randomUUID()
    await data.createMeeting(id, title.trim(), date)
    onCreate({ id, title: title.trim(), date, duration_secs: 0, summary: null, created_at: new Date().toISOString() })
  }
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-zinc-100 mb-4">新建组会</h3>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：第五次课题组会" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 mb-3 focus:outline-none focus:border-blue-600" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 mb-4 focus:outline-none [color-scheme:dark]" />
        <div className="flex gap-2 justify-end"><button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 cursor-pointer">取消</button><button onClick={submit} disabled={!title || !date} className="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white text-sm rounded-lg cursor-pointer">创建</button></div>
      </div>
    </div>
  )
}

// ---- Note type (simplified for UI) ----

type NoteItem = {
  id: string
  title: string
  content: string
  createdAt: string
}

// ---- Meeting Detail ----

function MeetingDetail({ meetingId, onBack, tasks, setTasks }: { meetingId: string; onBack: () => void; tasks: Task[]; setTasks: (t: Task[]) => void }) {
  const { asrApiKey, llmApiKey, meetings, setMeetings, literature, asrProvider, llmProvider } = useAppStore()
  const meeting = meetings.find((m) => m.id === meetingId)

  // Recording state
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [recStatus, setRecStatus] = useState<'idle' | 'recording' | 'processing' | 'done'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')
  const [startTime, setStartTime] = useState(0)

  // Notes
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [rightTab, setRightTab] = useState<'tasks' | 'notes' | 'literature'>('notes')
  const [newTask, setNewTask] = useState('')
  const [showNewNoteInput, setShowNewNoteInput] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const meetingTasks = tasks.filter((t) => t.meetingId === meetingId)

  // Linked literature
  const [linkedLit, setLinkedLit] = useState<Array<{ id: string; title: string; authors?: string | null }>>([])
  const [showLinkLit, setShowLinkLit] = useState(false)

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const notesRef = useRef<NoteItem[]>([])
  const activeNoteIdRef = useRef<string | null>(null)
  const editingTitleRef = useRef('')
  const editingContentRef = useRef('')

  // Wiki-link detection in meeting editor
  const wikiLinkMatch = useMemo(() => {
    const matches = editingContent.match(/\[\[([^\]]+)\]\]/g)
    return matches ? matches.map((m) => m.replace(/\[\[|\]\]/g, '')) : []
  }, [editingContent])

  // Load notes
  useEffect(() => {
    const loaded: NoteItem[] = JSON.parse(localStorage.getItem(`meeting-notes-${meetingId}`) || '[]')
    setNotes(loaded)
    notesRef.current = loaded
    if (loaded.length > 0 && !activeNoteIdRef.current) {
      setActiveNoteId(loaded[0].id)
      setEditingTitle(loaded[0].title)
      setEditingContent(loaded[0].content)
      activeNoteIdRef.current = loaded[0].id
      editingTitleRef.current = loaded[0].title
      editingContentRef.current = loaded[0].content
    }
    // Load linked literature
    data.getMeetingLiterature(meetingId).then((lit: Array<{ id: string; title: string; authors?: string | null }>) => setLinkedLit(lit))
  }, [meetingId])

  function persistNotes(updated: NoteItem[]) {
    setNotes(updated)
    notesRef.current = updated
    localStorage.setItem(`meeting-notes-${meetingId}`, JSON.stringify(updated))
  }

  function selectNote(note: NoteItem) {
    // Save current edits first using refs
    const cur = notesRef.current
    const aid = activeNoteIdRef.current
    if (aid && editingContentRef.current) {
      const updated = cur.map((n) => n.id === aid ? { ...n, title: editingTitleRef.current, content: editingContentRef.current } : n)
      persistNotes(updated)
    }
    setActiveNoteId(note.id)
    setEditingTitle(note.title)
    setEditingContent(note.content)
    activeNoteIdRef.current = note.id
    editingTitleRef.current = note.title
    editingContentRef.current = note.content
  }

  function saveCurrentNote() {
    const aid = activeNoteIdRef.current
    if (!aid) return
    const updated = notesRef.current.map((n) => n.id === aid ? { ...n, title: editingTitleRef.current, content: editingContentRef.current } : n)
    persistNotes(updated)
  }

  function handleNewNote() {
    if (!newNoteTitle.trim()) return
    const mt = meeting?.title || ''
    const note: NoteItem = {
      id: crypto.randomUUID(),
      title: newNoteTitle.trim(),
      content: `# ${newNoteTitle.trim()}\n\n[[${mt}]]\n\n`,
      createdAt: new Date().toISOString(),
    }
    const updated = [note, ...notes]
    persistNotes(updated)
    selectNote(note)
    setNewNoteTitle('')
    setShowNewNoteInput(false)
  }

  function handleDeleteNote(noteId: string) {
    const updated = notes.filter((n) => n.id !== noteId)
    persistNotes(updated)
    if (activeNoteId === noteId) {
      setActiveNoteId(updated[0]?.id || null)
      setEditingTitle(updated[0]?.title || '')
      setEditingContent(updated[0]?.content || '')
    }
  }

  // Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunks.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data) }
      recorder.onstop = () => { setAudioBlob(new Blob(chunks.current, { type: 'audio/webm' })); stream.getTracks().forEach((t) => t.stop()) }
      mediaRecorder.current = recorder; recorder.start(); setRecording(true); setStartTime(Date.now()); setRecStatus('recording'); setError('')
    } catch { setError('无法访问麦克风') }
  }
  const stopRecording = () => { mediaRecorder.current?.stop(); setRecording(false) }

  const handleProcess = async () => {
    if (!audioBlob) return
    setRecStatus('processing'); setError('')
    try {
      if (asrProvider === 'cloud' && !asrApiKey) throw new Error('需在设置中配置 ASR API Key')
      api.setAsrKey(asrApiKey); api.setLlmKey(llmApiKey)
      setStatusMsg('AI 转写中...')
      const isLocal = asrProvider === 'local'
      const asrResult = isLocal ? await api.transcribeAudioLocal(audioBlob) : await api.transcribeAudio(audioBlob)
      const transcriptText = asrResult.text
      setStatusMsg('AI 摘要生成中...')
      const duration = Math.round((Date.now() - startTime) / 1000)
      const summ = await api.summarizeText(transcriptText, 'meeting', llmProvider)

      await data.updateMeeting(meetingId, { transcript: transcriptText, summary: summ.summary, duration_secs: duration })
      setMeetings(meetings.map((m) => m.id === meetingId ? { ...m, summary: summ.summary, duration_secs: duration } : m))

      // Save as a note titled "组会记录"
      const md = buildMarkdown(meeting?.title || '组会', meeting?.date || '', transcriptText, summ.summary, summ.key_points)
      const recordNote: NoteItem = {
        id: crypto.randomUUID(),
        title: '组会记录',
        content: md,
        createdAt: new Date().toISOString(),
      }
      const updated = [recordNote, ...notes]
      persistNotes(updated)
      selectNote(recordNote)
      setRecStatus('done')

      // Auto-tasks
      const actionLines = summ.key_points.filter((p) => p.includes('需要') || p.includes('要') || p.includes('完成') || p.includes('做'))
      if (actionLines.length > 0) {
        const newTasks: Task[] = actionLines.map((t) => ({ id: crypto.randomUUID(), text: t, done: false, meetingId, meetingTitle: meeting?.title || '' }))
        const updatedTasks = [...tasks, ...newTasks]; setTasks(updatedTasks); localStorage.setItem('my-assistant-tasks', JSON.stringify(updatedTasks))
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : '处理失败'); setRecStatus('idle') }
  }

  function addTask() {
    if (!newTask.trim()) return
    const updated = [...tasks, { id: crypto.randomUUID(), text: newTask.trim(), done: false, meetingId, meetingTitle: meeting?.title || '' }]
    setTasks(updated); setNewTask(''); localStorage.setItem('my-assistant-tasks', JSON.stringify(updated))
  }

  const activeNote = notes.find((n) => n.id === activeNoteId)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer shrink-0">← 返回</button>
        <h2 className="text-sm font-semibold text-zinc-100 truncate">{meeting?.title || '组会详情'}</h2>
        <span className="text-xs text-blue-400 font-mono shrink-0">{meeting?.date}</span>
      </div>

      {error && <div className="mx-4 mt-3 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-300">{error}</div>}

      {/* Body: Center + Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Note Editor */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-zinc-800">
          {activeNoteId ? (
            <>
              {/* Note title bar */}
              <div className="flex items-center px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
                <input
                  value={editingTitle}
                  onChange={(e) => { setEditingTitle(e.target.value); editingTitleRef.current = e.target.value; saveCurrentNote() }}
                  onBlur={saveCurrentNote}
                  className="flex-1 text-sm font-medium bg-transparent text-zinc-200 focus:outline-none"
              />

              {wikiLinkMatch.length > 0 && (
                <div className="px-4 py-1.5 border-t border-zinc-800 bg-zinc-900/30 flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-zinc-600">🔗</span>
                  {wikiLinkMatch.map((t, i) => (
                    <span key={i} className="text-[10px] text-blue-400 bg-blue-500/10 px-1 rounded">{t}</span>
                  ))}
                </div>
              )}
                <button onClick={saveCurrentNote} className="text-[10px] text-zinc-500 hover:text-zinc-300 ml-2">保存</button>
              </div>
              {/* Editor area */}
              <textarea
                value={editingContent}
                onChange={(e) => { setEditingContent(e.target.value); editingContentRef.current = e.target.value; saveCurrentNote() }}
                onBlur={saveCurrentNote}
                className="flex-1 p-4 bg-transparent text-sm text-zinc-300 font-mono leading-relaxed resize-none focus:outline-none border-none"
                placeholder="# 开始写笔记..."
                style={{ fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace" }}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
              <div className="text-center">
                <p className="text-3xl mb-3">📄</p>
                <p>点击右侧「+ 新建笔记」开始记录</p>
                <p className="text-xs text-zinc-600 mt-1">或点击上方录音按钮录制组会</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-64 shrink-0 flex flex-col bg-zinc-900/30">
          {/* Recording */}
          <div className="p-3 border-b border-zinc-800">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">🎤 录音</h3>
            {recStatus === 'idle' && (
              <button onClick={startRecording} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg cursor-pointer">⏺ 开始录音</button>
            )}
            {recStatus === 'recording' && (
              <>
                <div className="text-center mb-2">
                  <div className="w-10 h-10 rounded-full bg-red-600 animate-pulse flex items-center justify-center mx-auto">
                    <span className="text-sm">⏺</span>
                  </div>
                  <p className="text-xs text-red-400 mt-1">录音中...</p>
                </div>
                <button onClick={stopRecording} className="w-full py-2 bg-zinc-600 hover:bg-zinc-500 text-white text-xs rounded-lg cursor-pointer mb-2">⏹ 停止录音</button>
                {audioBlob && (
                  <button onClick={handleProcess} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg cursor-pointer">🤖 转写并摘要</button>
                )}
              </>
            )}
            {recStatus === 'processing' && (
              <div className="text-center py-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                <p className="text-xs text-zinc-400">{statusMsg}</p>
              </div>
            )}
            {recStatus === 'done' && (
              <button onClick={() => { setRecStatus('idle'); setAudioBlob(null); setRecording(false) }} className="w-full py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs rounded-lg cursor-pointer">🔄 重新录音</button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            <button onClick={() => setRightTab('notes')} className={`flex-1 py-2 text-xs cursor-pointer ${rightTab === 'notes' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>
              ✏️ ({notes.length})
            </button>
            <button onClick={() => setRightTab('literature')} className={`flex-1 py-2 text-xs cursor-pointer ${rightTab === 'literature' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>
              📚 ({linkedLit.length})
            </button>
            <button onClick={() => setRightTab('tasks')} className={`flex-1 py-2 text-xs cursor-pointer ${rightTab === 'tasks' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>
              ✅ ({meetingTasks.filter((t) => !t.done).length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto">
            {rightTab === 'notes' && (
              <div className="p-2">
                {/* New note input */}
                {showNewNoteInput ? (
                  <div className="mb-2 flex gap-1">
                    <input autoFocus value={newNoteTitle} onChange={(e) => setNewNoteTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNewNote()}
                      onBlur={() => { if (!newNoteTitle) setShowNewNoteInput(false) }}
                      placeholder="笔记标题" className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none" />
                    <button onClick={handleNewNote} className="px-2 py-1 bg-blue-600 text-white text-xs rounded cursor-pointer">创建</button>
                  </div>
                ) : (
                  <button onClick={() => setShowNewNoteInput(true)} className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer mb-2">+ 新建笔记</button>
                )}

                {/* Note list */}
                <div className="space-y-0.5">
                  {notes.map((n) => (
                    <div key={n.id} onClick={() => selectNote(n)}
                      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs group ${
                        n.id === activeNoteId ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                      }`}>
                      <span className="truncate flex-1">{n.title}</span>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteNote(n.id) }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 ml-1 shrink-0">×</button>
                    </div>
                  ))}
                </div>
                {notes.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">暂无笔记</p>}
              </div>
            )}

            {rightTab === 'literature' && (
              <div className="p-2 space-y-1">
                {linkedLit.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-800 rounded text-xs cursor-pointer group"
                    onClick={() => { useAppStore.getState().setSelectedLiteratureId(l.id); useAppStore.getState().setPage('literature') }}>
                    <span className="truncate flex-1 text-zinc-300">{l.title}</span>
                    {l.authors && <span className="text-zinc-600 ml-1 shrink-0">{l.authors.split(',')[0]}</span>}
                  </div>
                ))}
                {linkedLit.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">暂无关联文献</p>}

                {showLinkLit ? (
                  <div className="mt-1 bg-zinc-800 rounded-lg p-1 max-h-40 overflow-y-auto">
                    <p className="text-[10px] text-zinc-500 px-2 py-1">选择要关联的文献</p>
                    {literature.filter((l) => !linkedLit.find((x) => x.id === l.id)).map((l) => (
                      <button key={l.id} onClick={async () => {
                        await data.linkLiteratureToMeeting(l.id, meetingId)
                        setLinkedLit([...linkedLit, { id: l.id, title: l.title, authors: l.authors }])
                        setShowLinkLit(false)
                      }}
                        className="w-full text-left px-2 py-1 hover:bg-zinc-700 rounded text-xs text-zinc-300 cursor-pointer truncate">
                        {l.title}
                      </button>
                    ))}
                    {literature.filter((l) => !linkedLit.find((x) => x.id === l.id)).length === 0 && (
                      <p className="text-xs text-zinc-600 px-2 py-1">所有文献已关联</p>
                    )}
                  </div>
                ) : (
                  <button onClick={() => setShowLinkLit(true)} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer mt-1">
                    + 关联文献
                  </button>
                )}
              </div>
            )}

            {rightTab === 'tasks' && (
              <div className="p-2 space-y-2">
                {meetingTasks.map((t) => (
                  <div key={t.id} className="flex items-start gap-2">
                    <input type="checkbox" checked={t.done} onChange={() => {
                      const u = tasks.map((x) => x.id === t.id ? { ...x, done: !x.done } : x)
                      setTasks(u); localStorage.setItem('my-assistant-tasks', JSON.stringify(u))
                    }} className="mt-0.5 rounded" />
                    <span className={`text-xs flex-1 ${t.done ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>{t.text}</span>
                  </div>
                ))}
                {meetingTasks.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">暂无待办</p>}
                <div className="flex gap-1">
                  <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()}
                    placeholder="添加待办..." className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none" />
                  <button onClick={addTask} className="px-2 py-1 bg-zinc-700 text-zinc-200 text-xs rounded cursor-pointer">+</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Markdown helpers ----

function buildMarkdown(title: string, date: string, transcript: string, summary: string, keyPoints: string[]): string {
  let md = `# ${title}\n\n**日期**: ${date}\n\n---\n\n`
  if (summary) md += `## 🤖 AI 摘要\n\n${summary}\n\n`
  if (keyPoints.length > 0) {
    md += `## 🔑 关键要点\n\n`
    keyPoints.forEach((p) => { md += `- ${p}\n` })
    md += `\n`
  }
  if (transcript) md += `## 📄 转写全文\n\n${transcript}\n\n`
  return md
}
