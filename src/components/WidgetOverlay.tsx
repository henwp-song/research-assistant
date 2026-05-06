import { useState, useEffect } from 'react'
import * as data from '../lib/data'

export default function WidgetOverlay() {
  const [reminder, setReminder] = useState<{
    meeting_id?: string
    title?: string
    date?: string
  }>({})
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    loadReminder()
    const interval = setInterval(loadReminder, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!reminder.date) { setCountdown('未设定'); return }
    const tick = () => {
      const now = new Date()
      const target = new Date(reminder.date + 'T00:00:00')
      const diff = target.getTime() - now.getTime()

      if (diff <= 0) {
        setCountdown('已过期')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

      if (days > 0) {
        setCountdown(`还剩 ${days} 天 ${hours} 小时`)
      } else if (hours > 0) {
        setCountdown(`还剩 ${hours} 小时`)
      } else {
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        setCountdown(`还剩 ${mins} 分钟`)
      }
    }
    tick()
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [reminder.date])

  async function loadReminder() {
    try {
      const inv = await import('@tauri-apps/api/core')
      const r = await inv.invoke('get_reminder') as {
        meeting_id?: string; title?: string; date?: string
      }
      setReminder(r)
    } catch {
      // Fallback to settings
      const id = await data.loadSetting('widget_reminder_id')
      if (id) {
        const meetings = await data.loadMeetings()
        const m = meetings.find((x) => x.id === id)
        if (m) setReminder({ meeting_id: m.id, title: m.title, date: m.date })
      }
    }
  }

  return (
    <div
      className="w-full h-screen flex items-end justify-end p-3"
      style={{
        background: 'transparent',
        WebkitAppRegion: 'drag' as never,
      }}
    >
      <div
        className="rounded-xl px-4 py-3 shadow-lg select-none"
        style={{
          background: 'rgba(15, 15, 18, 0.92)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          minWidth: 240,
          maxWidth: 280,
          WebkitAppRegion: 'no-drag' as never,
        }}
      >
        {reminder.title ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs">📝</span>
              <span className="text-[11px] font-medium text-zinc-300 line-clamp-1">
                {reminder.title}
              </span>
            </div>
            <div className="text-lg font-bold text-blue-400">{countdown}</div>
            <div className="text-[10px] text-zinc-500 mt-1">
              {reminder.date}
            </div>
          </>
        ) : (
          <div className="text-center py-3">
            <p className="text-xs text-zinc-500">组会科研助手</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">在设置中设定下次组会</p>
          </div>
        )}
      </div>
    </div>
  )
}
