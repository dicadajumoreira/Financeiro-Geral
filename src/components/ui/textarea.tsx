import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Desative passando uppercase={false}. Padrão: converte para CAIXA ALTA. */
  uppercase?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, uppercase = true, onChange, ...props }, ref) => (
    <textarea
      ref={ref}
      onChange={(e) => {
        if (uppercase && e.target.value) {
          e.target.value = e.target.value.toUpperCase()
        }
        onChange?.(e)
      }}
      style={uppercase ? { textTransform: 'uppercase' } : undefined}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm ' +
          'placeholder:text-muted-foreground placeholder:normal-case focus-visible:outline-none focus-visible:ring-2 ' +
          'focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
