import { useState, useEffect, useRef, useMemo } from 'react'
import { parseWikiLinks, findBacklinks } from '../lib/wikilinks'
import WikiText from './WikiText'

type NoteItem = { id: string; title: string; content: string; createdAt: string; sourceLabel?: string; sourceKey?: string }

interface Props {
  note: NoteItem
  onClose: () => void
  onSave: (note: NoteItem) => void
  onDelete?: (noteId: string) => void
  onNavigate?: (target: string, type: string, id: string) => void
}

function scanAllNoteTitles(): Array<{ id: string; title: string; content: string; sourceLabel?: string }> {
  const all: Array<{ id: string; title: string; content: string; sourceLabel?: string }> = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key.includes('-notes-') || key === 'standalone-notes') {
        try {
          const raw = JSON.parse(localStorage.getItem(key) || '[]')
          raw.forEach((n: { id: string; title: string; content: string }) => {
            all.push({ id: n.id, title: n.title, content: n.content, sourceLabel: key })
          })
        } catch {}
      }
    }
  } catch {}
  return all
}

export default function NoteModal({ note, onClose, onSave, onDelete, onNavigate }: Props) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [showPreview, setShowPreview] = useState(false)
  const titleRef = useRef(title)
  const contentRef = useRef(content)

  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
    titleRef.current = note.title
    contentRef.current = note.content
  }, [note.id])

  const links = useMemo(() => parseWikiLinks(content), [content])
  const backlinks = useMemo(() => {
    const allNotes = scanAllNoteTitles()
    // Remove self
    return findBacklinks(note.title, allNotes).filter((b) => b.id !== note.id)
  }, [note.title, note.id])

  function handleSave() {
    const updated = { ...note, title: titleRef.current, content: contentRef.current }
    onSave(updated)
  }

  function handleClose() {
    handleSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-[750px] max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
          <span className="text-sm">📄</span>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); titleRef.current = e.target.value }}
            onBlur={handleSave}
            className="flex-1 text-sm font-medium bg-transparent text-zinc-200 focus:outline-none"
          />
          {note.sourceLabel && (
            <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">{note.sourceLabel}</span>
          )}
          <button onClick={() => setShowPreview(!showPreview)}
            className={`text-xs px-2 py-1 rounded cursor-pointer ${showPreview ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
            预览
          </button>
          <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300 text-sm px-2 cursor-pointer">✕</button>
        </div>

        {/* Editor or Preview */}
        {showPreview ? (
          <div className="flex-1 p-4 overflow-auto min-h-[300px] text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
            <WikiText text={content} onNavigate={(link) => onNavigate?.(link.target, link.entityType || 'note', link.entityId || '')} />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); contentRef.current = e.target.value }}
            onBlur={handleSave}
            className="flex-1 p-4 bg-transparent text-sm text-zinc-300 font-mono leading-relaxed resize-none focus:outline-none min-h-[300px]"
            placeholder={`# 开始写笔记...\n\n用 [[链接]] 引用组会、文献、工作或其他笔记`}
            style={{ fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace" }}
          />
        )}

        {/* Wiki-link indicators */}
        {links.length > 0 && !showPreview && (
          <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/50">
            <span className="text-[10px] text-zinc-600">{links.length} 个链接: </span>
            {links.map((l, i) => (
              <span key={i} className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded mr-1">
                [[{l.target}]]
              </span>
            ))}
          </div>
        )}

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/50">
            <span className="text-[10px] text-zinc-500">引用此笔记: </span>
            {backlinks.map((b, i) => (
              <span key={i} className="text-[10px] text-zinc-400 mr-2">
                ← {b.title}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 shrink-0">
          <span className="text-xs text-zinc-600">支持 [[双向链接]] 语法</span>
          <div className="flex gap-2">
            {onDelete && (
              <button onClick={() => { onDelete(note.id); onClose() }}
                className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded cursor-pointer">删除</button>
            )}
            <button onClick={handleClose}
              className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded cursor-pointer">关闭</button>
          </div>
        </div>
      </div>
    </div>
  )
}
