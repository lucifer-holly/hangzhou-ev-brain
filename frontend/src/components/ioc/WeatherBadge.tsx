import { useEffect, useState } from 'react'
import { Cloud, CloudLightning, CloudRain, Sun, Wind } from 'lucide-react'

import { cn } from '@/lib/utils'

interface WeatherBadgeProps {
  className?: string
}

interface WeatherPreset {
  cond: string
  condEn: string
  tempC: number
  windKph: number
  pm25: number
  Icon: typeof Sun
  iconClass: string
}

const PRESETS: readonly WeatherPreset[] = [
  { cond: '晴', condEn: 'Sunny', tempC: 21, windKph: 7, pm25: 38, Icon: Sun, iconClass: 'text-ioc-warning' },
  { cond: '多云', condEn: 'Cloudy', tempC: 19, windKph: 11, pm25: 45, Icon: Cloud, iconClass: 'text-ioc-text-secondary' },
  { cond: '小雨', condEn: 'Light Rain', tempC: 17, windKph: 14, pm25: 32, Icon: CloudRain, iconClass: 'text-ioc-blue' },
  { cond: '雷阵雨', condEn: 'Thunderstorm', tempC: 16, windKph: 20, pm25: 28, Icon: CloudLightning, iconClass: 'text-ioc-warning' },
] as const

const CITY = { zh: '杭州', en: 'Hangzhou' }
const ROTATE_MS = 30_000

/**
 * Cycling weather badge — rotates through 4 synthetic conditions every
 * 30s. The spec marks real weather APIs as out-of-scope, so this gives
 * the IOC topbar some apparent liveness without a backend dependency.
 */
export function WeatherBadge({ className }: WeatherBadgeProps) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % PRESETS.length)
    }, ROTATE_MS)
    return () => clearInterval(t)
  }, [])

  const w = PRESETS[idx]
  const { Icon } = w
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-sm border border-ioc-border/50 bg-ioc-deep/70 px-2 py-1 text-xs transition-colors',
        className,
      )}
      title={`${CITY.en} · ${w.condEn} · auto-rotates every 30s`}
    >
      <Icon className={cn('h-3.5 w-3.5', w.iconClass)} />
      <div className="flex flex-col leading-tight">
        <span className="text-ioc-text-secondary">
          {CITY.zh} · {w.cond}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-ioc-text-muted">
          <span className="font-mono text-ioc-cyan">{w.tempC}°C</span>
          <span>·</span>
          <Wind className="h-2.5 w-2.5" />
          <span className="font-mono">{w.windKph}kph</span>
          <span>·</span>
          <span className="font-mono">PM2.5 {w.pm25}</span>
        </span>
      </div>
    </div>
  )
}
