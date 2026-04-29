import { Cloud, CloudRain, Sun, Wind } from 'lucide-react'

import { cn } from '@/lib/utils'

interface WeatherBadgeProps {
  className?: string
}

const PRESET = {
  city: '杭州',
  cityEn: 'Hangzhou',
  cond: '晴' as const,
  condEn: 'Sunny',
  tempC: 21,
  windKph: 7,
  pm25: 38,
}

/**
 * Static weather badge. The spec marks real weather APIs as out-of-scope
 * for the homepage demo, so we surface a fixed "晴 21°C" pill.
 */
export function WeatherBadge({ className }: WeatherBadgeProps) {
  const Icon =
    PRESET.cond === '晴' ? Sun : PRESET.cond === '阴' ? Cloud : (CloudRain as typeof Sun)
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-sm border border-ioc-border/50 bg-ioc-deep/70 px-2 py-1 text-xs',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 text-ioc-warning" />
      <div className="flex flex-col leading-tight">
        <span className="text-ioc-text-secondary">
          {PRESET.city} · {PRESET.cond}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-ioc-text-muted">
          <span className="font-mono text-ioc-cyan">{PRESET.tempC}°C</span>
          <span>·</span>
          <Wind className="h-2.5 w-2.5" />
          <span className="font-mono">{PRESET.windKph}kph</span>
          <span>·</span>
          <span className="font-mono">PM2.5 {PRESET.pm25}</span>
        </span>
      </div>
    </div>
  )
}
