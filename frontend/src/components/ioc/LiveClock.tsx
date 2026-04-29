import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

interface LiveClockProps {
  /** IANA timezone, e.g. 'Asia/Shanghai'. */
  tz?: string
  className?: string
}

const dayNamesZh = ['日', '一', '二', '三', '四', '五', '六']

function format(d: Date, tz: string) {
  // Use Intl with the requested timezone to derive parts.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(d)
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? ''
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const time = `${get('hour')}:${get('minute')}:${get('second')}`
  // Get weekday index (0=Sun) by parsing weekday short.
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const w = weekdayMap[get('weekday')] ?? 0
  const dayZh = `周${dayNamesZh[w]}`
  return { date, time, dayZh }
}

export function LiveClock({ tz = 'Asia/Shanghai', className }: LiveClockProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { date, time, dayZh } = format(now, tz)

  return (
    <div className={cn('flex items-center gap-2 font-mono text-xs leading-tight', className)}>
      <div className="flex flex-col items-end">
        <span className="text-ioc-text-muted">
          {date} · {dayZh}
        </span>
        <span className="font-title font-bold tracking-[0.15em] text-ioc-cyan text-glow-cyan">
          {time}
        </span>
      </div>
      <span className="rounded-sm bg-ioc-cyan/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ioc-cyan">
        {tz.split('/').pop()}
      </span>
    </div>
  )
}
