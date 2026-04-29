/**
 * Global footer — sits at the bottom of every console layout.
 * Two variants tied to the surrounding theme: dark (City IOC) and
 * light (Operator/Driver SaaS).
 */

import { cn } from '@/lib/utils'

interface FooterProps {
  theme?: 'dark' | 'light'
  className?: string
}

export function Footer({ theme = 'dark', className }: FooterProps) {
  const dark = theme === 'dark'
  return (
    <footer
      className={cn(
        'flex h-9 shrink-0 items-center justify-between border-t px-4 text-[11px]',
        dark
          ? 'border-white/5 bg-ioc-deep/80 text-ioc-text-muted'
          : 'border-saas-border bg-white text-saas-text-light',
        className,
      )}
    >
      <div className="flex items-center gap-2 truncate">
        <span className={cn('font-display font-semibold', dark ? 'text-ioc-cyan' : 'text-saas-accent')}>
          智枢
        </span>
        <span className="opacity-60">·</span>
        <span className="hidden truncate sm:inline">
          From Pile to Brain · From Charging to Governing
        </span>
        <span className="truncate sm:hidden">From Pile to Brain</span>
      </div>
      <div className="hidden font-mono text-[10px] uppercase tracking-wider md:block">
        Built with FastAPI · React · PyTorch · ESP32 · YOLOv8
      </div>
      <div className="font-mono text-[10px] uppercase tracking-wider md:hidden">
        v0.9.5
      </div>
    </footer>
  )
}
