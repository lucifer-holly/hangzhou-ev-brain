import * as React from 'react'

import { cn } from '@/lib/utils'

interface DetailHeaderProps {
  /** Small uppercase label above the title — e.g. "01 · Heatmap". */
  eyebrow?: string
  title: string
  subtitle?: string
  /** Right-aligned controls slot (window switch, action buttons, …). */
  right?: React.ReactNode
  className?: string
}

/**
 * Standard SaaS-light page header used by every detail page.
 *
 * Sticks to the same layout — eyebrow + title + subtitle on the left,
 * action controls on the right — so the seven detail pages feel like
 * one product instead of seven prototypes.
 */
export function DetailHeader({
  eyebrow,
  title,
  subtitle,
  right,
  className,
}: DetailHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-saas-border pb-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div>
        {eyebrow ? (
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-saas-accent/80">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-saas-text-dark">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-saas-text-mid">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}
