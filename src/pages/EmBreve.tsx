import { Rocket } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function EmBreve({ titulo, fase }: { titulo: string; fase: string }) {
  return (
    <div>
      <PageHeader title={titulo} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <Badge variant="secondary">{fase}</Badge>
          <p className="max-w-md text-sm text-muted-foreground">
            Este módulo faz parte de uma fase futura do roadmap. O núcleo financeiro (lançamentos,
            relatórios e cadastros) é prioridade da Fase 1.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
