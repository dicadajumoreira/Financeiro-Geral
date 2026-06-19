import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Mensagem clara em dev caso as variáveis não estejam configuradas.
  console.error(
    'Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. ' +
      'Copie .env.example para .env e preencha com os dados do seu projeto Supabase.',
  )
}

export const supabase = createClient<Database>(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
