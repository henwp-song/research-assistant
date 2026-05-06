const BASE_URL = 'http://127.0.0.1:9877'

let asrKey: string | null = null
let llmKey: string | null = null
let agentKey: string | null = null

export function setAsrKey(key: string) { asrKey = key }
export function setLlmKey(key: string) { llmKey = key }
export function setAgentKey(key: string) { agentKey = key }

export function setApiKey(key: string) {
  // Legacy: sets all keys
  asrKey = key
  llmKey = key
  agentKey = key
}

function asrHeaders(): Record<string, string> {
  if (asrKey) return { 'X-API-Key': asrKey }
  return {}
}

function llmHeaders(): Record<string, string> {
  if (llmKey) return { 'X-API-Key': llmKey }
  return {}
}

export interface TranscribeResponse {
  text: string
}

export interface LocalTranscribeResponse {
  text: string
  model: string
  segments: { start: number; end: number; text: string }[]
}

export interface SummarizeResponse {
  summary: string
  key_points: string[]
  provider?: string
}

export interface PDFExtractResponse {
  text: string
  pages: number
  title: string | null
  authors: string | null
  doi: string | null
  keywords: string | null
  year: number | null
}

export interface LiteratureLookupResponse {
  title: string | null
  authors: string | null
  year: number | null
  journal: string | null
  doi: string | null
  abstract: string | null
  keywords: string[]
  citation_count: number | null
  url: string | null
  source: string
}

export interface StructuredNotesResponse {
  summary: string
  key_points: string[]
  research_problem: string
  methodology: string
  innovations: string
  conclusions: string
}

export interface OllamaStatus {
  available: boolean
  models: string[]
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`)
    return res.ok
  } catch {
    return false
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscribeResponse> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'recording.wav')
  const res = await fetch(`${BASE_URL}/api/asr/transcribe`, {
    method: 'POST',
    headers: asrHeaders(),
    body: formData,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }
  return res.json()
}

export async function transcribeAudioLocal(audioBlob: Blob): Promise<LocalTranscribeResponse> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'recording.wav')
  const res = await fetch(`${BASE_URL}/api/asr/transcribe-local`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }
  return res.json()
}

export async function summarizeText(
  text: string,
  type: 'meeting' | 'literature' = 'meeting',
  provider: 'openai' | 'ollama' = 'openai'
): Promise<SummarizeResponse> {
  const res = await fetch(`${BASE_URL}/api/llm/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...llmHeaders(),
    },
    body: JSON.stringify({ text, type, provider }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }
  return res.json()
}

export async function lookupLiterature(title?: string, doi?: string): Promise<LiteratureLookupResponse> {
  const res = await fetch(`${BASE_URL}/api/literature/lookup-auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title || null, doi: doi || null }),
  })
  if (!res.ok) return {} as LiteratureLookupResponse
  return res.json()
}

export async function extractPDF(file: File): Promise<PDFExtractResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE_URL}/api/pdf/extract`, {
    method: 'POST',
    headers: llmHeaders(),
    body: formData,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }
  return res.json()
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${BASE_URL}/api/llm/ollama/status`)
    return res.json()
  } catch {
    return { available: false, models: [] }
  }
}

export async function ragSearch(query: string, limit = 10): Promise<Array<{
  id: string; content: string; type: string; source_id?: string; score: number
}>> {
  const res = await fetch(`${BASE_URL}/api/rag/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  })
  if (!res.ok) return []
  return res.json()
}

export async function ragIndex(documents: Array<{ id: string; content: string; type: string; source_id?: string }>): Promise<{ indexed: number }> {
  const res = await fetch(`${BASE_URL}/api/rag/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents }),
  })
  return res.json()
}

export async function ragStats(): Promise<{ count: number }> {
  const res = await fetch(`${BASE_URL}/api/rag/stats`)
  if (!res.ok) return { count: 0 }
  return res.json()
}
