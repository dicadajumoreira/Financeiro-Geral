import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'

const variants: Record<Variant, string> = {
  default: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary text-secondary-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  outline: 'border border-border text-foreground',
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
