import { cn } from '@/lib/utils'

interface ScanLineProps {
  className?: string
}

/**
 * Decorative horizontal scan line that sweeps top→bottom across its parent.
 * Drop into a relatively-positioned IOC panel; uses `pointer-events-none`
 * so it never steals clicks.
 */
export function ScanLine({ className }: ScanLineProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 h-[2px]',
        'bg-gradient-to-b from-transparent via-ioc-cyan/70 to-transparent',
        'animate-scan-line shadow-[0_0_12px_rgba(0,212,255,0.6)]',
        className,
      )}
    />
  )
}
