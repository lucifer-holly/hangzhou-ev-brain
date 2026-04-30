/**
 * Sidebar "Powered by" mini badge — text-only to keep weight near zero.
 *
 * Acts as the entry point to the Architecture modal:
 * clicking opens the full system-architecture explainer.
 */

import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'

import { ArchitectureModal } from '@/components/ArchitectureModal'

const STACK_LINES: readonly string[] = [
  'FastAPI · React · PyTorch',
  'XGBoost · YOLOv8 · ESP32',
]

export function TechStackPanel() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-press group flex w-full flex-col gap-1.5 rounded-md border border-ioc-border/40 bg-ioc-deep/50 px-3 py-2.5 text-left transition-colors hover:border-ioc-cyan/40 hover:bg-ioc-cyan/5"
      >
        <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-ioc-text-muted">
          <span>Powered by</span>
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        <div className="flex flex-col gap-0.5 font-mono text-[10px] leading-tight text-ioc-text-secondary group-hover:text-ioc-cyan">
          {STACK_LINES.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-ioc-text-muted/70 group-hover:text-ioc-cyan/80">
          点击查看架构 · view architecture
        </div>
      </button>
      <ArchitectureModal open={open} onOpenChange={setOpen} />
    </>
  )
}
