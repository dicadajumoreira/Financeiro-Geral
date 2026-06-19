import { type ReactNode } from 'react'
import { Building2 } from 'lucide-react'
import { useOrg } from '@/contexts/OrgContext'
import { Card, CardContent } from '@/components/ui/card'
import type { Company } from '@/types/database'

/**
 * Garante que uma empresa esteja selecionada no seletor do topo.
 * Usado em telas que operam sobre uma única empresa (ex.: plano de contas).
 */
export function RequireCompany({ children }: { children: (company: Company) => ReactNode }) {
  const { currentCompany, companies } = useOrg()

  if (!currentCompany) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <p className="font-medium">Selecione uma empresa</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {companies.length === 0
              ? 'Cadastre uma empresa primeiro (menu Empresas).'
              : 'Use o seletor no topo da tela para escolher a empresa que deseja gerenciar.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return <>{children(currentCompany)}</>
}
