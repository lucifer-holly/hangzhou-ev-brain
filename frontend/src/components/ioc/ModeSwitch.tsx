import { Activity, History, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ConsoleMode = 'realtime' | 'history' | 'predict'

interface ModeSwitchProps {
  mode: ConsoleMode
  onChange: (m: ConsoleMode) => void
  className?: string
}

const ITEMS: { mode: ConsoleMode; label: string; cn: string; Icon: typeof Activity }[] = [
  { mode: 'realtime', label: '实时 · Realtime', cn: 'cyan', Icon: Activity },
  { mode: 'history', label: '历史 · History', cn: 'muted', Icon: History },
  { mode: 'predict', label: '预测 · Forecast', cn: 'blue', Icon: Sparkles },
]

const activeStyle: Record<string, string> = {
  cyan: 'bg-ioc-cyan/20 text-ioc-cyan shadow-ioc-glow border-ioc-cyan/60',
  muted: 'bg-ioc-text-muted/10 text-ioc-text-secondary border-ioc-text-muted/40',
  blue: 'bg-ioc-blue/20 text-ioc-blue shadow-[0_0_16px_rgba(74,158,255,0.45)] border-ioc-blue/60',
}

export function ModeSwitch({ mode, onChange, className }: ModeSwitchProps) {
  return (
    <div
      role="tablist"
      aria-label="Console mode"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-ioc-border/50 bg-ioc-deep/70 p-0.5 backdrop-blur',
        className,
      )}
    >
      {ITEMS.map((it) => {
        const isActive = mode === it.mode
        return (
          <button
            key={it.mode}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(it.mode)}
            className={cn(
              'flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] transition-all',
              isActive
                ? activeStyle[it.cn]
                : 'border-transparent text-ioc-text-muted hover:bg-ioc-panel/60 hover:text-ioc-text-secondary',
            )}
          >
            <it.Icon className="h-3 w-3" />
            <span>{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
