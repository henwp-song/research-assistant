import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import * as api from '../lib/api'
import * as data from '../lib/data'

export default function SettingsPage() {
  const {
    asrApiKey, setAsrApiKey, llmApiKey, setLlmApiKey, agentApiKey, setAgentApiKey,
    asrProvider, setAsrProvider, llmProvider, setLlmProvider,
    backendHealthy, setBackendHealthy, ollamaAvailable, setOllamaAvailable,
    widgetShown, setWidgetShown, reminderMeetingId, setReminderMeetingId,
    meetings,
  } = useAppStore()

  const [asrKey, setAsrKey] = useState(asrApiKey)
  const [llmKey, setLlmKey] = useState(llmApiKey)
  const [agentKey, setAgentKey] = useState(agentApiKey)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      data.loadSetting('asr_api_key'), data.loadSetting('llm_api_key'), data.loadSetting('agent_api_key'),
      data.loadSetting('asr_provider'), data.loadSetting('llm_provider'),
      data.loadSetting('widget_reminder_id'),
    ]).then(([ak, lk, gk, ap, lp, wr]) => {
      if (ak) { setAsrApiKey(ak); setAsrKey(ak); api.setAsrKey(ak) }
      if (lk) { setLlmApiKey(lk); setLlmKey(lk); api.setLlmKey(lk) }
      if (gk) { setAgentApiKey(gk); setAgentKey(gk); api.setAgentKey(gk) }
      if (ap) setAsrProvider(ap as 'local' | 'openai')
      if (lp) setLlmProvider(lp as 'ollama' | 'openai')
      if (wr) setReminderMeetingId(wr)
    })
    checkHealth(); checkOllama()
  }, [])

  useEffect(() => { const i = setInterval(checkHealth, 10000); return () => clearInterval(i) }, [])

  async function checkHealth() { setBackendHealthy(await api.healthCheck()) }
  async function checkOllama() { const s = await api.checkOllamaStatus(); setOllamaAvailable(s.available) }

  async function handleSave() {
    setAsrApiKey(asrKey); api.setAsrKey(asrKey)
    setLlmApiKey(llmKey); api.setLlmKey(llmKey)
    setAgentApiKey(agentKey); api.setAgentKey(agentKey)
    await data.saveSetting('asr_api_key', asrKey)
    await data.saveSetting('llm_api_key', llmKey)
    await data.saveSetting('agent_api_key', agentKey)
    await data.saveSetting('asr_provider', asrProvider)
    await data.saveSetting('llm_provider', llmProvider)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function handleToggleWidget() {
    if (widgetShown) {
      setWidgetShown(false)
      try { await (await import('@tauri-apps/api/core')).invoke('toggle_widget') } catch {}
    } else {
      if (!reminderMeetingId) { alert('请先选择要跟踪的组会'); return }
      setWidgetShown(true)
      try { await (await import('@tauri-apps/api/core')).invoke('toggle_widget') } catch {}
    }
  }

  async function handleSetReminder(meetingId: string) {
    setReminderMeetingId(meetingId)
    const m = meetings.find((x) => x.id === meetingId)
    if (m) {
      await data.saveSetting('widget_reminder_id', meetingId)
      try {
        await (await import('@tauri-apps/api/core')).invoke('set_reminder', {
          meetingId: m.id, title: m.title, date: m.date,
        })
      } catch {}
    }
  }

  return (
    <div className="p-6 max-w-lg space-y-5">
      <h2 className="text-lg font-semibold text-zinc-100">设置</h2>

      {/* Backend Status */}
      <Section title="服务状态">
        <StatusRow label="Python Backend" ok={backendHealthy} detail="127.0.0.1:9877" />
        <StatusRow label="Ollama (本地LLM)" ok={ollamaAvailable} detail="127.0.0.1:11434" />
        {!ollamaAvailable && (
          <p className="text-xs text-zinc-500 mt-1">
            安装: ollama.com/download，然后 <code className="bg-zinc-800 px-1 rounded">ollama pull qwen2.5:3b</code>
          </p>
        )}
      </Section>

      {/* ASR */}
      <Section title="语音转文字 (ASR)">
        <div className="flex gap-2 mb-2">
          <Opt active={asrProvider === 'local'} onClick={() => setAsrProvider('local')}>本地 Whisper</Opt>
          <Opt active={asrProvider === 'openai'} onClick={() => setAsrProvider('openai')}>OpenAI</Opt>
        </div>
        {asrProvider === 'openai' && (
          <ApiKeyInput value={asrKey} onChange={setAsrKey} placeholder="OpenAI API Key (sk-...)" />
        )}
      </Section>

      {/* LLM */}
      <Section title="AI 摘要模型 (LLM)">
        <div className="flex gap-2 mb-2">
          <Opt active={llmProvider === 'ollama'} onClick={() => setLlmProvider('ollama')}>Ollama 本地</Opt>
          <Opt active={llmProvider === 'openai'} onClick={() => setLlmProvider('openai')}>OpenAI</Opt>
        </div>
        {llmProvider === 'openai' && (
          <ApiKeyInput value={llmKey} onChange={setLlmKey} placeholder="OpenAI API Key (sk-...)" />
        )}
      </Section>

      {/* Agent (future) */}
      <Section title="联网搜索 Agent (预留)">
        <p className="text-xs text-zinc-400 mb-2">使用 LLM 的 API Key 和模型，后续可独立配置</p>
        <select
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 opacity-50 cursor-not-allowed"
          disabled
          defaultValue="gpt-4o-mini"
        >
          <option value="gpt-4o-mini">GPT-4o-mini (简单搜索)</option>
          <option value="gpt-4o">GPT-4o (复杂推理)</option>
        </select>
        <p className="text-xs text-zinc-500 mt-1">Agent 工作流将在后续版本实现（思考模式/工具调用等）</p>
      </Section>

      {/* Widget */}
      <Section title="桌面小组件">
        <div className="mb-2">
          <label className="text-xs text-zinc-400 mb-1 block">跟踪组会</label>
          <select
            value={reminderMeetingId || ''}
            onChange={(e) => handleSetReminder(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200"
          >
            <option value="">不提醒</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>{m.title} ({m.date})</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleToggleWidget}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
            widgetShown ? 'bg-red-600' : 'bg-green-600'
          } text-white`}
        >
          {widgetShown ? '关闭桌面组件' : '开启桌面组件'}
        </button>
      </Section>

      {/* Knowledge Base */}
      <Section title="知识库 (RAG)">
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              try {
                const { ragIndex } = await import('../lib/api')
                const { meetings, literature } = useAppStore.getState()
                const docs = [
                  ...meetings.filter((m) => m.summary).map((m) => ({
                    id: m.id, content: `${m.title}\n${m.summary}`, type: 'meeting', source_id: m.id,
                  })),
                  ...literature.filter((l) => l.summary).map((l) => ({
                    id: l.id, content: `${l.title}\n${l.summary}`, type: 'literature', source_id: l.id,
                  })),
                ]
                if (docs.length === 0) { alert('暂无内容可索引，请先添加组会或文献'); return }
                const result = await ragIndex(docs)
                alert(`已索引 ${result.indexed} 篇文档`)
              } catch { alert('索引失败，请确保 Python Backend 运行中') }
            }}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-md cursor-pointer"
          >
            重建知识库索引
          </button>
          <span className="text-xs text-zinc-500">将组会摘要和文献总结向量化，支持语义搜索</span>
        </div>
      </Section>

      <button
        onClick={handleSave}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
          saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {saved ? '已保存 ✓' : '保存设置'}
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm text-zinc-300">{label}</span>
      <span className="text-xs text-zinc-600 ml-auto">{detail}</span>
    </div>
  )
}

function Opt({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
        active ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
      }`}
    >
      {children}
    </button>
  )
}

function ApiKeyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600"
    />
  )
}
