import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-ioc-cyan/15 text-ioc-cyan border border-ioc-cyan/40',
        success: 'bg-ioc-success/15 text-ioc-success border border-ioc-success/40',
        warning: 'bg-ioc-warning/15 text-ioc-warning border border-ioc-warning/40',
        danger: 'bg-ioc-danger/15 text-ioc-danger border border-ioc-danger/40',
        outline: 'text-ioc-text-secondary border border-ioc-border',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
