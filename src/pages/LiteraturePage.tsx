import { useState, useRef, useEffect } from 'react'
import { useAppStore, type Literature, type Work } from '../stores/appStore'
import * as api from '../lib/api'
import * as data from '../lib/data'

export default function LiteraturePage() {
  const { literature, setLiterature, llmApiKey, selectedLiteratureId, setSelectedLiteratureId, llmProvider, works } =
    useAppStore()
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    data.loadLiterature().then(setLiterature)
    data.loadSetting('llm_api_key').then((key) => {
      if (key) { useAppStore.getState().setLlmApiKey(key); api.setLlmKey(key) }
    })
  }, [])

  if (selectedLiteratureId) {
    return (
      <LiteratureDetail
        literatureId={selectedLiteratureId}
        onBack={() => setSelectedLiteratureId(null)}
        works={works}
      />
    )
  }

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) return
    setLoading(true); setError(''); setStatus('提取文本...')

    try {
      api.setLlmKey(llmApiKey)
      const pdfData = await api.extractPDF(file)

      setStatus('联网查询元数据...')
      let meta: api.LiteratureLookupResponse = {}
      try {
        meta = await api.lookupLiterature(pdfData.title || undefined, pdfData.doi || undefined)
      } catch { /* ignore lookup failures */ }

      const id = crypto.randomUUID()
      const title = meta.title || pdfData.title || file.name.replace('.pdf', '')
      const authors = meta.authors || pdfData.authors || null
      const year = meta.year || pdfData.year || null
      const journal = meta.journal || null
      const doi = meta.doi || pdfData.doi || null
      const keywords = (meta.keywords || []).join(', ') || pdfData.keywords || null
      const abstract = meta.abstract || null

      await data.createLiterature(id, title, authors, year, journal, doi, keywords, null, abstract)

      let summary = ''
      let structured_notes = ''
      if (pdfData.text.length > 100) {
        setStatus('AI 生成摘要...')
        const summ = await api.summarizeText(pdfData.text, 'literature', llmProvider)
        summary = summ.summary

        setStatus('AI 结构化分析...')
        const detailPrompt = `请对以下论文进行结构化分析，用中文输出：

1. 研究问题：
2. 研究方法：
3. 创新点：
4. 结论与局限：

论文内容：${pdfData.text.slice(0, 4000)}`
        const detail = await api.summarizeText(detailPrompt, 'literature', llmProvider)
        structured_notes = detail.summary

        await data.updateLiterature(id, { summary, structured_notes })
      }

      const item: Literature = {
        id, title, authors, year, journal, doi, keywords, category: null,
        abstract, summary, structured_notes,
        created_at: new Date().toISOString(),
      }

      setLiterature([item, ...literature])
      setStatus('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '处理失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-zinc-100 mb-4">文献管理</h2>

      {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => fileInput.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4 ${
          dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/50'
        }`}
      >
        {loading ? (
          <div>
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-zinc-400">{status}</p>
          </div>
        ) : (
          <div>
            <p className="text-3xl mb-2">📄</p>
            <p className="text-sm text-zinc-400">拖入PDF</p>
            <p className="text-xs text-zinc-600 mt-1">自动提取文本 + 联网查询元数据 + AI摘要</p>
          </div>
        )}
        <input ref={fileInput} type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} className="hidden" />
      </div>

      {literature.length === 0 ? (
        <div className="text-center py-12 text-zinc-500"><p>暂无文献</p></div>
      ) : (
        <div className="space-y-2">
          {literature.map((l) => (
            <div key={l.id} onClick={() => setSelectedLiteratureId(l.id)}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-zinc-200 line-clamp-1">{l.title}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {l.authors && <span className="text-xs text-zinc-500">{l.authors}</span>}
                    {l.year && <span className="text-xs text-zinc-600">{l.year}</span>}
                    {l.journal && <span className="text-xs text-zinc-600 italic">{l.journal}</span>}
                  </div>
                  {l.summary && <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{l.summary}</p>}
                </div>
                {l.keywords && (
                  <div className="shrink-0 flex flex-wrap gap-1 max-w-[120px]">
                    {l.keywords.split(',').slice(0, 2).map((k, i) => (
                      <span key={i} className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{k.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LiteratureDetail({ literatureId, onBack, works }: { literatureId: string; onBack: () => void; works: Work[] }) {
  const { literature, meetings } = useAppStore()
  const [linkedMeetings, setLinkedMeetings] = useState<Array<{ id: string; title: string; date: string }>>([])
  const [showLink, setShowLink] = useState(false)
  const [showWorkMenu, setShowWorkMenu] = useState(false)
  const item = literature.find((l) => l.id === literatureId)

  useEffect(() => { data.getLiteratureMeetings(literatureId).then(setLinkedMeetings as never) }, [literatureId])

  async function handleLink(meetingId: string) {
    await data.linkLiteratureToMeeting(literatureId, meetingId)
    setShowLink(false)
    const m = meetings.find((x) => x.id === meetingId)
    if (m && !linkedMeetings.find((x) => x.id === meetingId)) {
      setLinkedMeetings([...linkedMeetings, { id: m.id, title: m.title, date: m.date }])
    }
  }

  if (!item) {
    return <div className="p-6"><button onClick={onBack} className="text-sm text-zinc-400">← 返回</button><p className="text-zinc-500 mt-4">文献未找到</p></div>
  }

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={onBack} className="text-sm text-zinc-400 hover:text-zinc-200 mb-4 cursor-pointer">← 返回列表</button>

      {/* Title + Actions */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{item.title}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            {item.authors && <span className="text-sm text-zinc-400">{item.authors}</span>}
            {item.year && <span className="text-xs text-zinc-500">({item.year})</span>}
            {item.journal && <span className="text-xs text-zinc-500 italic">{item.journal}</span>}
            {item.doi && <span className="text-xs text-blue-500 font-mono">{item.doi}</span>}
          </div>
        </div>
        <div className="flex gap-1 relative">
          <div className="relative">
            <button onClick={() => setShowWorkMenu(!showWorkMenu)} className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded cursor-pointer">归类</button>
            {showWorkMenu && (
              <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 w-40">
                {works.map((w) => (
                  <button key={w.id} onClick={() => { data.assignLiteratureToWork(item.id, w.id); setShowWorkMenu(false) }}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-700 text-xs text-zinc-300">{w.name}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setShowLink(!showLink)} className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded cursor-pointer">关联组会</button>
          {showLink && (
            <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 w-56 max-h-48 overflow-y-auto">
              {meetings.length === 0 ? <p className="text-xs text-zinc-500 px-3 py-2">暂无组会</p> :
                meetings.map((m) => (
                  <button key={m.id} onClick={() => handleLink(m.id)} className="w-full text-left px-3 py-1.5 hover:bg-zinc-700 text-xs text-zinc-300">
                    {m.title} <span className="text-zinc-600 ml-1">{m.date}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Keywords */}
      {item.keywords && (
        <div className="flex flex-wrap gap-1 mb-4">
          {item.keywords.split(',').map((k, i) => (
            <span key={i} className="text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{k.trim()}</span>
          ))}
        </div>
      )}

      {/* Abstract */}
      {item.abstract && (
        <Section title="📋 摘要">{item.abstract}</Section>
      )}

      {/* AI Summary */}
      {item.summary && (
        <Section title="🤖 AI 总结">{item.summary}</Section>
      )}

      {/* Structured Notes */}
      {item.structured_notes && (
        <Section title="📊 结构化分析">
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-sans">{item.structured_notes}</pre>
        </Section>
      )}

      {/* Linked Meetings */}
      {linkedMeetings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <h3 className="text-xs text-zinc-500 mb-2">关联组会</h3>
          {linkedMeetings.map((m) => (
            <span key={m.id} className="inline-block text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded mr-1 mb-1">📝 {m.title} ({m.date})</span>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-2">{title}</h3>
      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300">{children}</div>
    </div>
  )
}
