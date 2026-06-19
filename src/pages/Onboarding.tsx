import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useOrg } from '@/contexts/OrgContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Onboarding() {
  const { user } = useAuth()
  const { org, refresh } = useOrg()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Já possui organização → segue para o app.
  if (org) {
    navigate('/', { replace: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    // O trigger handle_new_org() cria a membership owner automaticamente.
    const { error } = await supabase
      .from('organizations')
      .insert({ name, created_by: user!.id })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    await refresh()
    navigate('/empresas', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Bem-vindo(a)! 👋</CardTitle>
          <CardDescription>
            Crie sua organização. Ela agrupará todas as suas empresas (CNPJs) e usuários.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org">Nome da organização / grupo</Label>
              <Input
                id="org"
                placeholder="Ex.: Grupo J2M"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando…' : 'Criar organização'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
