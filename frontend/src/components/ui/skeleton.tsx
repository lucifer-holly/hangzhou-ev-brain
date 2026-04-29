/**
 * Generic skeleton loading block.
 *
 * Two presets via the `tone` prop: dark (IOC console) and light (SaaS).
 * Animated via Tailwind's `animate-pulse`. Dimensions/border radius are
 * caller-controlled via `className`.
 */

import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'dark' | 'light'
}

export function Skeleton({ tone = 'dark', className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md',
        tone === 'dark'
          ? 'bg-ioc-cyan/10 ring-1 ring-ioc-cyan/15'
          : 'bg-saas-bg-alt ring-1 ring-saas-border',
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      {...props}
    />
  )
}

/** Stack of skeleton rows for a list. */
export function SkeletonRows({
  count = 5,
  rowClassName,
  tone = 'dark',
}: {
  count?: number
  rowClassName?: string
  tone?: 'dark' | 'light'
}) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          tone={tone}
          className={cn('h-8 w-full', rowClassName)}
        />
      ))}
    </div>
  )
}
