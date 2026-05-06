import type { Meeting, Literature, Work } from '../stores/appStore'

let _invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null
let _checkedTauri = false

async function getInvoke() {
  if (_checkedTauri) return _invoke
  _checkedTauri = true
  try {
    // Only use Tauri invoke if we're in a Tauri webview
    if (!(window as unknown as Record<string, unknown>).__TAURI__) return null
    const mod = await import('@tauri-apps/api/core')
    _invoke = mod.invoke
    return _invoke
  } catch {
    return null
  }
}

function localDB() {
  const raw = localStorage.getItem('my-assistant-data')
  if (!raw) return { meetings: [], literature: [], works: [] }
  try {
    return JSON.parse(raw)
  } catch {
    return { meetings: [], literature: [], works: [] }
  }
}

function saveLocalDB(data: { meetings: Meeting[]; literature: Literature[]; works?: Work[] }) {
  localStorage.setItem('my-assistant-data', JSON.stringify(data))
}

// ---- Meetings ----

export async function loadMeetings(): Promise<Meeting[]> {
  const inv = await getInvoke()
  if (inv) return inv('get_meetings') as Promise<Meeting[]>
  return localDB().meetings
}

export async function createMeeting(id: string, title: string, date: string): Promise<void> {
  const inv = await getInvoke()
  if (inv) return inv('create_meeting', { id, title, date }) as Promise<void>
  // Local fallback
  const db = localDB()
  db.meetings.unshift({
    id,
    title,
    date,
    duration_secs: 0,
    summary: null,
    created_at: new Date().toISOString(),
  })
  saveLocalDB(db)
}

export async function updateMeeting(
  id: string,
  data: { transcript?: string; summary?: string; duration_secs?: number }
): Promise<void> {
  const inv = await getInvoke()
  if (inv)
    return inv('update_meeting', {
      id,
      transcript: data.transcript || null,
      summary: data.summary || null,
      durationSecs: data.duration_secs || null,
      audioPath: null,
    }) as Promise<void>
  // Local fallback
  const db = localDB()
  const m = db.meetings.find((m: Meeting) => m.id === id)
  if (m) {
    if (data.summary !== undefined) m.summary = data.summary
    if (data.duration_secs !== undefined) m.duration_secs = data.duration_secs
    saveLocalDB(db)
  }
}

// ---- Literature ----

export async function loadLiterature(): Promise<Literature[]> {
  const inv = await getInvoke()
  if (inv) return inv('get_literature') as Promise<Literature[]>
  return localDB().literature
}

export async function createLiterature(
  id: string,
  title: string,
  authors?: string,
  year?: number,
  journal?: string,
  doi?: string,
  keywords?: string,
  category?: string,
  abstract_text?: string,
): Promise<void> {
  const inv = await getInvoke()
  if (inv)
    return inv('create_literature', {
      id, title,
      authors: authors || null,
      year: year || null,
      journal: journal || null,
      doi: doi || null,
      keywords: keywords || null,
      category: category || null,
      abstractText: abstract_text || null,
    }) as Promise<void>
  const db = localDB()
  db.literature.unshift({
    id, title,
    authors: authors || null,
    year: year || null,
    journal: journal || null,
    doi: doi || null,
    keywords: keywords || null,
    category: category || null,
    abstract: abstract_text || null,
    summary: null,
    structured_notes: null,
    created_at: new Date().toISOString(),
  })
  saveLocalDB(db)
}

export async function updateLiterature(
  id: string,
  data: {
    extracted_text?: string; summary?: string; structured_notes?: string;
    keywords?: string; category?: string; abstract_text?: string
  }
): Promise<void> {
  const inv = await getInvoke()
  if (inv)
    return inv('update_literature', {
      id,
      extractedText: data.extracted_text || null,
      summary: data.summary || null,
      pdfPath: null,
      structuredNotes: data.structured_notes || null,
      keywords: data.keywords || null,
      category: data.category || null,
      abstractText: data.abstract_text || null,
    }) as Promise<void>
  const db = localDB()
  const l = db.literature.find((l: Literature) => l.id === id)
  if (l) {
    if (data.summary !== undefined) l.summary = data.summary
    if (data.keywords !== undefined) l.keywords = data.keywords
    if (data.category !== undefined) l.category = data.category
    if (data.abstract_text !== undefined) l.abstract = data.abstract_text
    if (data.structured_notes !== undefined) l.structured_notes = data.structured_notes
    saveLocalDB(db)
  }
}

export async function linkLiteratureToMeeting(literatureId: string, meetingId: string): Promise<void> {
  const inv = await getInvoke()
  if (inv) return inv('link_literature_meeting', { literatureId, meetingId }) as Promise<void>
  // No local fallback for relationships
}

export async function searchAll(query: string): Promise<Array<{
  type: 'meeting' | 'literature'
  id: string
  title: string
  summary?: string
  authors?: string
}>> {
  const inv = await getInvoke()
  if (inv) return inv('search_all', { query }) as Promise<unknown[]>
  const db = localDB()
  const q = query.toLowerCase()
  const results: unknown[] = []
  for (const m of db.meetings) {
    if (m.title.toLowerCase().includes(q) || m.summary?.toLowerCase().includes(q)) {
      results.push({ type: 'meeting', id: m.id, title: m.title, summary: m.summary })
    }
  }
  for (const l of db.literature) {
    if (l.title.toLowerCase().includes(q) || l.authors?.toLowerCase().includes(q) || l.summary?.toLowerCase().includes(q)) {
      results.push({ type: 'literature', id: l.id, title: l.title, summary: l.summary, authors: l.authors })
    }
  }
  return results as never[]
}

export async function getMeetingLiterature(meetingId: string): Promise<Array<{
  id: string
  title: string
  authors?: string
  year?: number
  summary?: string
}>> {
  const inv = await getInvoke()
  if (inv) return inv('get_meeting_literature', { meetingId }) as Promise<unknown[]>
  return []
}

export async function getLiteratureMeetings(literatureId: string): Promise<Array<{
  id: string
  title: string
  date: string
}>> {
  const inv = await getInvoke()
  if (inv) return inv('get_literature_meetings', { literatureId }) as Promise<unknown[]>
  return []
}

// ---- Works ----

export async function loadWorks(): Promise<Work[]> {
  const inv = await getInvoke()
  if (inv) return inv('get_works') as Promise<Work[]>
  return localDB().works || []
}

export async function createWork(id: string, name: string, description: string, color: string): Promise<void> {
  const inv = await getInvoke()
  if (inv) return inv('create_work', { id, name, description, color }) as Promise<void>
  const db = localDB()
  if (!db.works) db.works = []
  db.works.push({ id, name, description, color })
  saveLocalDB(db)
}

export async function assignMeetingToWork(meetingId: string, workId: string): Promise<void> {
  const inv = await getInvoke()
  if (inv) return inv('assign_meeting_to_work', { meetingId, workId }) as Promise<void>
}

export async function assignLiteratureToWork(literatureId: string, workId: string): Promise<void> {
  const inv = await getInvoke()
  if (inv) return inv('assign_literature_to_work', { literatureId, workId }) as Promise<void>
}

// ---- Notes ----

export async function loadNotes(sourceType?: string, sourceId?: string): Promise<Array<{
  id: string; title: string; content: string; source_type: string; source_id?: string | null;
  linked_note_ids: string; created_at: string; updated_at: string
}>> {
  const inv = await getInvoke()
  if (inv) return inv('get_notes', { sourceType: sourceType || null, sourceId: sourceId || null }) as Promise<never[]>
  const raw = localStorage.getItem(`notes_${sourceType || 'all'}_${sourceId || 'all'}`)
  return raw ? JSON.parse(raw) : []
}

export async function saveNote(id: string, title: string, content: string, sourceType: string, sourceId?: string): Promise<void> {
  const inv = await getInvoke()
  if (inv) return inv('save_note', { id, title, content, sourceType, sourceId: sourceId || null }) as Promise<void>
  const key = `notes_${sourceType}_${sourceId || 'all'}`
  const notes = JSON.parse(localStorage.getItem(key) || '[]')
  const idx = notes.findIndex((n: { id: string }) => n.id === id)
  const note = { id, title, content, source_type: sourceType, source_id: sourceId, linked_note_ids: '[]', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  if (idx >= 0) notes[idx] = { ...notes[idx], ...note }
  else notes.unshift(note)
  localStorage.setItem(key, JSON.stringify(notes))
}

export async function deleteNote(id: string): Promise<void> {
  const inv = await getInvoke()
  if (inv) return inv('delete_note', { id }) as Promise<void>
}

// ---- Settings ----

export async function loadSetting(key: string): Promise<string | null> {
  const inv = await getInvoke()
  if (inv) {
    const val = await inv('get_setting', { key })
    return val as string | null
  }
  return localStorage.getItem(`setting_${key}`)
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const inv = await getInvoke()
  if (inv) return inv('set_setting', { key, value }) as Promise<void>
  localStorage.setItem(`setting_${key}`, value)
}
