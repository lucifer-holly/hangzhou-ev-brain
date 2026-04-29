/**
 * Tech-stack showcase ribbon — surfaces the project's engineering surface
 * area in the empty real estate next to the Operator console title block
 * (and anywhere else with similar empty space).
 *
 * Two variants:
 *   - full    : multi-line stack list + "查看架构" CTA → opens the
 *               <ArchitectureModal> with the full diagram + AI metrics
 *   - compact : single-line tag strip for a topbar
 *
 * Pure text + state — no extra runtime cost beyond the modal lazy-import
 * already done in TechStackPanel.
 */

import { useState } from 'react'
import { ArrowUpRight, Cpu, Layers } from 'lucide-react'

import { ArchitectureModal } from '@/components/ArchitectureModal'
import { cn } from '@/lib/utils'

const STACK_GROUPS: { label: string; items: string[] }[] = [
  { label: 'Frontend', items: ['React', 'TypeScript', 'Tailwind', 'ECharts', 'AMap'] },
  { label: 'Cloud', items: ['FastAPI', 'SQLite', 'Mosquitto', 'PyTorch', 'XGBoost', 'YOLOv8'] },
  { label: 'Edge', items: ['ESP32-S3', 'TFLite Micro', 'PID', 'Fuzzy'] },
]

interface Props {
  variant?: 'full' | 'compact'
  /** Color theme: dark for IOC topbars/cards, light for SaaS title blocks. */
  theme?: 'dark' | 'light'
  className?: string
}

export function TechStackRibbon({ variant = 'full', theme = 'light', className }: Props) {
  const [open, setOpen] = useState(false)

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'btn-press hover-glow group flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors',
            theme === 'dark'
              ? 'border-ioc-border/50 bg-ioc-deep/60 text-ioc-text-secondary hover:border-ioc-cyan/40 hover:text-ioc-cyan'
              : 'border-saas-border bg-white text-saas-text-mid hover:border-saas-accent/40 hover:text-saas-accent',
            className,
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="font-medium">Tech Stack</span>
          <span className="font-mono text-[10px] opacity-70">15+</span>
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
        <ArchitectureModal open={open} onOpenChange={setOpen} />
      </>
    )
  }

  // Full variant
  const dark = theme === 'dark'
  return (
    <>
      <div
        className={cn(
          'rounded-lg border px-4 py-3',
          dark
            ? 'border-ioc-cyan/25 bg-ioc-panel/40'
            : 'border-saas-border bg-gradient-to-br from-white to-saas-bg-alt/60',
          className,
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className={cn('h-4 w-4', dark ? 'text-ioc-cyan' : 'text-saas-accent')} />
            <span
              className={cn(
                'font-display text-xs font-semibold uppercase tracking-[0.18em]',
                dark ? 'text-ioc-cyan' : 'text-saas-accent',
              )}
            >
              Tech Stack · 技术栈
            </span>
          </div>
          <button
            onClick={() => setOpen(true)}
            className={cn(
              'btn-press flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors',
              dark
                ? 'text-ioc-text-muted hover:bg-ioc-cyan/10 hover:text-ioc-cyan'
                : 'text-saas-text-light hover:bg-saas-accent/10 hover:text-saas-accent',
            )}
          >
            查看架构 <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {STACK_GROUPS.map((g) => (
            <div key={g.label} className="flex items-baseline gap-2 text-[11px]">
              <span
                className={cn(
                  'w-14 shrink-0 font-mono uppercase tracking-wider',
                  dark ? 'text-ioc-text-muted' : 'text-saas-text-light',
                )}
              >
                {g.label}
              </span>
              <span
                className={cn(
                  'flex flex-wrap gap-x-1.5 gap-y-0.5',
                  dark ? 'text-ioc-text-secondary' : 'text-saas-text-mid',
                )}
              >
                {g.items.map((it, i) => (
                  <span key={it}>
                    <span className="font-medium">{it}</span>
                    {i < g.items.length - 1 ? (
                      <span
                        className={cn(
                          'mx-1.5 opacity-30',
                          dark ? 'text-ioc-text-muted' : 'text-saas-text-light',
                        )}
                      >
                        ·
                      </span>
                    ) : null}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
      <ArchitectureModal open={open} onOpenChange={setOpen} />
    </>
  )
}
