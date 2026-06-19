import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Força (ou desativa) a transformação em CAIXA ALTA. Por padrão, campos de
   *  texto livre são automaticamente convertidos para maiúsculas. */
  uppercase?: boolean
}

// Tipos que NUNCA devem ser convertidos para maiúsculas (e-mail, senha, etc.).
const NO_UPPERCASE_TYPES = [
  'email',
  'password',
  'number',
  'date',
  'datetime-local',
  'time',
  'url',
  'tel',
  'color',
  'file',
  'range',
  'checkbox',
  'radio',
]

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, uppercase, onChange, type, ...props }, ref) => {
    const doUpper = uppercase ?? !NO_UPPERCASE_TYPES.includes(type ?? 'text')

    return (
      <input
        ref={ref}
        type={type}
        onChange={(e) => {
          if (doUpper && e.target.value) {
            e.target.value = e.target.value.toUpperCase()
          }
          onChange?.(e)
        }}
        style={doUpper ? { textTransform: 'uppercase' } : undefined}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ' +
            'placeholder:text-muted-foreground placeholder:normal-case focus-visible:outline-none focus-visible:ring-2 ' +
            'focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
