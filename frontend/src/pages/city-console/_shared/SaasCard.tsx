import * as React from 'react'

import { cn } from '@/lib/utils'

interface SaasCardProps {
  title?: React.ReactNode
  /** Optional right-aligned slot in the card header (status pill, hint, …). */
  accessory?: React.ReactNode
  /** When true, the card body keeps its default padding. Set false for tables / maps. */
  padded?: boolean
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

/**
 * Light-mode container used by every detail page.  Mirrors the visual
 * weight of `<TechBorder>` on the IOC homepage but flipped to a clean
 * SaaS look — white surface, hairline border, no neon.
 */
export function SaasCard({
  title,
  accessory,
  padded = true,
  className,
  bodyClassName,
  children,
}: SaasCardProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border border-saas-border bg-white shadow-sm',
        className,
      )}
    >
      {title || accessory ? (
        <header className="flex items-center justify-between border-b border-saas-border px-4 py-3">
          {typeof title === 'string' ? (
            <h2 className="text-sm font-semibold text-saas-text-dark">{title}</h2>
          ) : (
            title
          )}
          {accessory ? <div>{accessory}</div> : null}
        </header>
      ) : null}
      <div className={cn(padded ? 'p-4' : '', bodyClassName)}>{children}</div>
    </section>
  )
}
