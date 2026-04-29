import * as React from 'react'

import { cn } from '@/lib/utils'

interface PulseDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'success' | 'cyan' | 'warning' | 'danger' | 'muted'
  size?: 'sm' | 'md' | 'lg'
}

const toneMap = {
  success: 'bg-ioc-success shadow-[0_0_10px_rgba(0,255,148,0.85)]',
  cyan: 'bg-ioc-cyan shadow-[0_0_10px_rgba(0,212,255,0.85)]',
  warning: 'bg-ioc-warning shadow-[0_0_10px_rgba(255,184,0,0.85)]',
  danger: 'bg-ioc-danger shadow-[0_0_10px_rgba(255,107,53,0.85)]',
  muted: 'bg-ioc-text-muted shadow-none',
} as const

const sizeMap = { sm: 'h-1.5 w-1.5', md: 'h-2.5 w-2.5', lg: 'h-3.5 w-3.5' } as const

/** Map / status pulse: a colored core plus an animated halo ring. */
export function PulseDot({
  tone = 'success',
  size = 'md',
  className,
  ...rest
}: PulseDotProps) {
  return (
    <span
      className={cn('relative inline-flex items-center justify-center', className)}
      {...rest}
    >
      <span
        className={cn(
          'absolute inline-flex rounded-full opacity-70 animate-pulse-ring',
          toneMap[tone],
          sizeMap[size],
        )}
      />
      <span className={cn('relative inline-flex rounded-full', toneMap[tone], sizeMap[size])} />
    </span>
  )
}
