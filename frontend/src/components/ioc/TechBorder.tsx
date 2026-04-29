import * as React from 'react'

import { cn } from '@/lib/utils'

interface TechBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true, soften the cyan border to a subtle warning tint. */
  variant?: 'cyan' | 'warning' | 'danger' | 'muted'
}

/**
 * Chamfered "tech" panel: clipped corners + glowing edge + glass background.
 * Wrap any content; don't put extra padding on the wrapper.
 */
export const TechBorder = React.forwardRef<HTMLDivElement, TechBorderProps>(
  ({ className, variant = 'cyan', children, ...props }, ref) => {
    const tone =
      variant === 'cyan'
        ? 'before:bg-ioc-cyan/40'
        : variant === 'warning'
          ? 'before:bg-ioc-warning/40'
          : variant === 'danger'
            ? 'before:bg-ioc-danger/40'
            : 'before:bg-ioc-border'

    return (
      <div
        ref={ref}
        className={cn(
          'relative isolate',
          'before:absolute before:inset-0 before:-z-10 before:clip-tech',
          tone,
          className,
        )}
        {...props}
      >
        {/* h-full + flex on the nested wrappers propagates parent grid/flex height
            down to user content. Without this, nested clip-tech divs size to
            content and any inner `h-full` collapses to 0 (e.g. LiveEventStream's
            scroll area becomes invisible). */}
        <div className="clip-tech bg-ioc-panel-solid/80 backdrop-blur-md p-px h-full flex flex-col">
          <div className="clip-tech bg-ioc-deep/80 flex-1 min-h-0 flex flex-col">
            {children}
          </div>
        </div>
      </div>
    )
  },
)
TechBorder.displayName = 'TechBorder'
