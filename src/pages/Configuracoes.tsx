import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

interface MemberRow {
  user_id: string
  role: string
  profiles: { full_name: string | null; email: string | null } | null
}

export default function Configuracoes() {
  const { org, role } = useOrg()
  const { user } = useAuth()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const { data: members } = useQuery({
    queryKey: ['members', org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('user_id, role, profiles(full_name, email)')
      if (error) throw error
      return data as unknown as MemberRow[]
    },
    enabled: !!org,
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Organização, equipe e preferências." />

      <Card>
        <CardHeader>
          <CardTitle>Organização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Nome:</span> {org?.name}
          </p>
          <p>
            <span className="text-muted-foreground">Seu papel:</span>{' '}
            <Badge variant="secondary">{role}</Badge>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Nome</TH>
                <TH>E-mail</TH>
                <TH>Papel</TH>
              </TR>
            </THead>
            <TBody>
              {members?.map((m) => (
                <TR key={m.user_id}>
                  <TD>
                    {m.profiles?.full_name || '—'}
                    {m.user_id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                  </TD>
                  <TD>{m.profiles?.email || '—'}</TD>
                  <TD>
                    <Badge variant="secondary">{m.role}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />
            Modo escuro
          </label>
        </CardContent>
      </Card>
    </div>
  )
}
