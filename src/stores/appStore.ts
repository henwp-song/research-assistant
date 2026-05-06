import { create } from 'zustand'

export interface Meeting {
  id: string
  title: string
  date: string
  duration_secs: number
  summary: string | null
  created_at: string
  work_id?: string
}

export interface Literature {
  id: string
  title: string
  authors: string | null
  year: number | null
  journal: string | null
  doi: string | null
  keywords: string | null
  category: string | null
  abstract: string | null
  summary: string | null
  structured_notes: string | null
  created_at: string
}

export interface Work {
  id: string
  name: string
  description: string
  color: string
}

export type Page = 'meetings' | 'literature' | 'works' | 'notes' | 'settings'

export type AsrProvider = 'local' | 'openai'
export type LlmProvider = 'ollama' | 'openai'

interface AppState {
  page: Page
  setPage: (page: Page) => void

  // Separate API Keys
  asrApiKey: string
  setAsrApiKey: (key: string) => void
  llmApiKey: string
  setLlmApiKey: (key: string) => void
  agentApiKey: string
  setAgentApiKey: (key: string) => void

  // Provider settings
  asrProvider: AsrProvider
  setAsrProvider: (p: AsrProvider) => void
  llmProvider: LlmProvider
  setLlmProvider: (p: LlmProvider) => void

  // Meetings
  meetings: Meeting[]
  setMeetings: (meetings: Meeting[]) => void

  // Literature
  literature: Literature[]
  setLiterature: (literature: Literature[]) => void

  // Works
  works: Work[]
  setWorks: (works: Work[]) => void

  // Backend health
  backendHealthy: boolean
  setBackendHealthy: (healthy: boolean) => void
  ollamaAvailable: boolean
  setOllamaAvailable: (available: boolean) => void

  // Widget
  widgetShown: boolean
  setWidgetShown: (shown: boolean) => void
  reminderMeetingId: string | null
  setReminderMeetingId: (id: string | null) => void

  // Selected detail
  selectedMeetingId: string | null
  setSelectedMeetingId: (id: string | null) => void
  selectedLiteratureId: string | null
  setSelectedLiteratureId: (id: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  page: 'meetings',
  setPage: (page) => set({ page }),

  asrApiKey: '',
  setAsrApiKey: (asrApiKey) => set({ asrApiKey }),
  llmApiKey: '',
  setLlmApiKey: (llmApiKey) => set({ llmApiKey }),
  agentApiKey: '',
  setAgentApiKey: (agentApiKey) => set({ agentApiKey }),

  asrProvider: 'local',
  setAsrProvider: (asrProvider) => set({ asrProvider }),
  llmProvider: 'ollama',
  setLlmProvider: (llmProvider) => set({ llmProvider }),

  meetings: [],
  setMeetings: (meetings) => set({ meetings }),

  literature: [],
  setLiterature: (literature) => set({ literature }),

  works: [],
  setWorks: (works) => set({ works }),

  backendHealthy: false,
  setBackendHealthy: (backendHealthy) => set({ backendHealthy }),
  ollamaAvailable: false,
  setOllamaAvailable: (ollamaAvailable) => set({ ollamaAvailable }),

  widgetShown: false,
  setWidgetShown: (widgetShown) => set({ widgetShown }),
  reminderMeetingId: null,
  setReminderMeetingId: (reminderMeetingId) => set({ reminderMeetingId }),

  selectedMeetingId: null,
  setSelectedMeetingId: (selectedMeetingId) => set({ selectedMeetingId }),

  selectedLiteratureId: null,
  setSelectedLiteratureId: (selectedLiteratureId) => set({ selectedLiteratureId }),
}))
