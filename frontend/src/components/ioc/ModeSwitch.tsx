import { Activity, History, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ConsoleMode = 'realtime' | 'history' | 'predict'

interface ModeSwitchProps {
  mode: ConsoleMode
  onChange: (m: ConsoleMode) => void
  className?: string
}

interface Item {
  mode: ConsoleMode
  label_zh: string
  label_en: string
  hint: string
  Icon: typeof Activity
  tone: 'cyan' | 'muted' | 'blue'
}

const ITEMS: readonly Item[] = [
  { mode: 'realtime', label_zh: '实时', label_en: 'Live', hint: 'WebSocket 1Hz', Icon: Activity, tone: 'cyan' },
  { mode: 'history', label_zh: '历史', label_en: 'History', hint: '24h ago', Icon: History, tone: 'muted' },
  { mode: 'predict', label_zh: '预测', label_en: 'Forecast', hint: 'LSTM +1h', Icon: Sparkles, tone: 'blue' },
] as const

const ACTIVE: Record<Item['tone'], string> = {
  cyan: 'bg-ioc-cyan/20 text-ioc-cyan border-ioc-cyan/60 shadow-ioc-glow',
  muted: 'bg-ioc-text-muted/15 text-ioc-text-secondary border-ioc-text-muted/40',
  blue: 'bg-ioc-blue/20 text-ioc-blue border-ioc-blue/60 shadow-[0_0_18px_rgba(74,158,255,0.45)]',
}

/**
 * Console mode switcher — realtime / history / predict.
 *
 * Compared to the original (small uppercase pills), each tab now exposes
 * a clear stacked layout: icon + 中文 + English label + parenthetical
 * hint of the data semantics. Bigger hit-target (py-2 px-4), explicit
 * borders, and tone-tinted active state make it impossible to miss.
 */
export function ModeSwitch({ mode, onChange, className }: ModeSwitchProps) {
  return (
    <div
      role="tablist"
      aria-label="Console mode"
      className={cn(
        'inline-flex items-stretch gap-1 rounded-md border border-ioc-border/50 bg-ioc-deep/70 p-1 backdrop-blur',
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
              'btn-press flex min-w-[120px] items-center gap-2 rounded-sm border px-3 py-2 transition-all',
              isActive
                ? ACTIVE[it.tone]
                : 'border-transparent text-ioc-text-muted hover:bg-ioc-panel/60 hover:text-ioc-text-secondary',
            )}
          >
            <it.Icon className={cn('h-4 w-4 shrink-0', isActive && 'animate-pulse')} />
            <div className="flex flex-col items-start leading-tight text-left">
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold">{it.label_zh}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
                  {it.label_en}
                </span>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider opacity-65">
                {it.hint}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
