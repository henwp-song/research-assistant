import { useEffect, useRef, useState } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { replaceAll, getMarkdown } from '@milkdown/kit/utils'
import * as data from '../lib/data'

export interface NoteData {
  id: string
  title: string
  content: string
  source_type: string
  source_id?: string
  linked_note_ids: string
  created_at: string
  updated_at: string
}

interface Props {
  sourceType: string
  sourceId?: string
  notes: NoteData[]
  onNotesChange: (notes: NoteData[]) => void
}

export default function NoteEditor({ sourceType, sourceId, notes, onNotesChange }: Props) {
  const [noteList, setNoteList] = useState(notes)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(noteList[0]?.id || null)
  const [title, setTitle] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const editorInstance = useRef<Editor | null>(null)

  const activeNote = noteList.find((n) => n.id === activeNoteId)

  useEffect(() => {
    if (!activeNoteId || !editorRef.current) return
    if (editorInstance.current) editorInstance.current.destroy()

    const note = noteList.find((n) => n.id === activeNoteId)
    if (!note) return
    setTitle(note.title)

    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorRef.current!)
        ctx.set(defaultValueCtx, note.content || '# 新笔记\n\n开始写...')
        ctx.get(listenerCtx).markdownUpdated((_, md) => {
          // Auto-save on change (debounced in real app)
          saveNoteContent(note.id, md)
        })
      })
      .use(commonmark)
      .use(history)
      .use(listener)
      .create()
      .then((editor) => {
        editorInstance.current = editor
      })

    return () => {
      editorInstance.current?.destroy()
      editorInstance.current = null
    }
  }, [activeNoteId])

  async function saveNoteContent(noteId: string, content: string) {
    const note = noteList.find((n) => n.id === noteId)
    if (!note) return
    const updated = noteList.map((n) => n.id === noteId ? { ...n, content } : n)
    setNoteList(updated)
    onNotesChange(updated)
    await data.saveNote(noteId, note.title, content, sourceType, sourceId)
  }

  async function handleNewNote() {
    const id = crypto.randomUUID()
    const title = `笔记 ${noteList.length + 1}`
    const newNote: NoteData = {
      id, title, content: '', source_type: sourceType, source_id: sourceId,
      linked_note_ids: '[]', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    await data.saveNote(id, title, '', sourceType, sourceId)
    const updated = [newNote, ...noteList]
    setNoteList(updated)
    onNotesChange(updated)
    setActiveNoteId(id)
  }

  async function handleTitleChange(newTitle: string) {
    setTitle(newTitle)
    if (!activeNote) return
    const updated = noteList.map((n) => n.id === activeNote.id ? { ...n, title: newTitle } : n)
    setNoteList(updated)
    onNotesChange(updated)
    await data.saveNote(activeNote.id, newTitle, activeNote.content, sourceType, sourceId)
  }

  async function handleDelete() {
    if (!activeNote) return
    await data.deleteNote(activeNote.id)
    const updated = noteList.filter((n) => n.id !== activeNote.id)
    setNoteList(updated)
    onNotesChange(updated)
    setActiveNoteId(updated[0]?.id || null)
  }

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Note tabs */}
      <div className="flex items-center bg-zinc-900 border-b border-zinc-800 px-2 overflow-x-auto">
        {noteList.map((n) => (
          <button
            key={n.id}
            onClick={() => setActiveNoteId(n.id)}
            className={`shrink-0 px-3 py-2 text-xs border-r border-zinc-800 transition-colors cursor-pointer ${
              n.id === activeNoteId
                ? 'bg-zinc-800 text-zinc-200'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            {n.title}
          </button>
        ))}
        <button
          onClick={handleNewNote}
          className="shrink-0 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer"
        >
          + 新建
        </button>
        {activeNote && (
          <button
            onClick={handleDelete}
            className="shrink-0 px-2 py-2 text-xs text-zinc-600 hover:text-red-400 cursor-pointer ml-auto"
            title="删除"
          >
            ×
          </button>
        )}
      </div>

      {/* Title */}
      {activeNote && (
        <div className="px-4 pt-3">
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="笔记标题"
            className="w-full text-sm font-medium bg-transparent text-zinc-200 placeholder-zinc-600 focus:outline-none"
          />
        </div>
      )}

      {/* Editor */}
      <div className="min-h-[200px]">
        {activeNote ? (
          <div ref={editorRef} className="prose prose-invert prose-sm max-w-none p-4 min-h-[200px] focus:outline-none" />
        ) : (
          <div className="flex items-center justify-center h-[200px] text-zinc-500 text-sm">
            点击 "+ 新建" 创建笔记
          </div>
        )}
      </div>
    </div>
  )
}
