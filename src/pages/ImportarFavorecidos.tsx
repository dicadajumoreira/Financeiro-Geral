import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import { formatDocument } from '@/lib/format'
import { readFavorecidos, type ParsedFavorecido } from '@/lib/finance/favorecidosParser'
import type { Contact, ContactType } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

const TYPES: { value: ContactType; label: string }[] = [
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'ambos', label: 'Ambos' },
]

export default function ImportarFavorecidos() {
  const { org, canWrite } = useOrg()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedFavorecido[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  // Documentos já cadastrados, para evitar duplicados.
  const { data: existingDocs } = useQuery({
    queryKey: ['contact-docs', org?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('document')
      if (error) throw error
      return new Set((data as Pick<Contact, 'document'>[]).map((c) => (c.document ?? '').replace(/\D/g, '')).filter(Boolean))
    },
    enabled: !!org,
  })

  function handleFile(file: File) {
    setError(null)
    setDone(null)
    file
      .arrayBuffer()
      .then((buf) => {
        const parsed = readFavorecidos(buf)
        if (parsed.length === 0) {
          setError('Não encontrei favorecidos. Verifique se a planilha tem as colunas Nome e CPF/CNPJ.')
          return
        }
        // Desmarca os que já existem (mesmo documento).
        const withExisting = parsed.map((p) => ({
          ...p,
          include: !(p.document && existingDocs?.has(p.document)),
        }))
        setRows(withExisting)
        setFileName(file.name)
      })
      .catch((e) => setError(`Falha ao ler o arquivo: ${(e as Error).message}`))
  }

  const importMut = useMutation({
    mutationFn: async () => {
      const toImport = rows.filter((r) => r.include && r.name)
      const payload = toImport.map((r) => ({
        org_id: org!.id,
        type: r.type,
        name: r.name,
        document: r.document || null,
        bank_info: r.bankInfo && Object.keys(r.bankInfo).length ? r.bankInfo : null,
        is_active: true,
      }))
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from('contacts').insert(payload.slice(i, i + 200))
        if (error) throw error
      }
      return payload.length
    },
    onSuccess: async (count) => {
      setDone(count)
      setRows([])
      setFileName('')
      await qc.invalidateQueries({ queryKey: ['contacts'] })
      await qc.invalidateQueries({ queryKey: ['contact-docs'] })
    },
    onError: (e) => setError((e as Error).message),
  })

  function setType(id: string, type: ContactType) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, type } : r)))
  }
  function setAllTypes(type: ContactType) {
    setRows((prev) => prev.map((r) => ({ ...r, type })))
  }

  const stats = useMemo(() => {
    const incl = rows.filter((r) => r.include)
    return { total: rows.length, incl: incl.length, existentes: rows.filter((r) => r.document && existingDocs?.has(r.document)).length }
  }, [rows, existingDocs])

  if (!canWrite) {
    return (
      <div>
        <PageHeader title="Importar favorecidos" />
        <Card><CardContent className="py-10 text-center text-muted-foreground">Você não tem permissão para importar.</CardContent></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Importar favorecidos"
        description="Suba a planilha de favorecidos (.xlsx ou .csv). Cadastra clientes/fornecedores com CPF/CNPJ, PIX e dados bancários."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 py-5">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Escolher arquivo
          </Button>
          {fileName && <span className="flex items-center gap-2 text-sm text-muted-foreground"><FileSpreadsheet className="h-4 w-4" /> {fileName}</span>}
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-destructive/40"><CardContent className="flex items-center gap-2 py-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {error}</CardContent></Card>
      )}
      {done !== null && (
        <Card className="mb-4 border-success/40"><CardContent className="flex items-center gap-2 py-4 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> {done} contato(s) importado(s)! Veja em Contatos.</CardContent></Card>
      )}

      {rows.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">{stats.incl}/{stats.total} selecionados</Badge>
            {stats.existentes > 0 && <Badge variant="warning">{stats.existentes} já cadastrados (desmarcados)</Badge>}
            <span className="text-muted-foreground">Classificar todos como:</span>
            {TYPES.map((t) => (
              <Button key={t.value} variant="ghost" size="sm" onClick={() => setAllTypes(t.value)}>{t.label}</Button>
            ))}
            <Button size="sm" className="ml-auto" onClick={() => importMut.mutate()} disabled={importMut.isPending || stats.incl === 0}>
              {importMut.isPending ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} Importar {stats.incl}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-8"></TH>
                    <TH>Nome</TH>
                    <TH>CPF/CNPJ</TH>
                    <TH>Tipo</TH>
                    <TH>PIX / Conta</TH>
                    <TH className="w-8"></TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => {
                    const exists = r.document && existingDocs?.has(r.document)
                    const b = r.bankInfo
                    const bankStr = b.pix_tipo
                      ? `PIX ${b.pix_tipo}: ${b.pix_chave ?? ''}`
                      : b.tipo_conta
                        ? `${b.tipo_conta} Ag ${b.agencia ?? '—'} CC ${b.conta ?? '—'}`
                        : '—'
                    return (
                      <TR key={r.id} className={!r.include ? 'opacity-40' : undefined}>
                        <TD><input type="checkbox" checked={r.include} onChange={(e) => setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, include: e.target.checked } : x))} /></TD>
                        <TD className="min-w-[200px] font-medium">
                          {r.name}
                          {exists && <Badge variant="warning" className="ml-2">já existe</Badge>}
                        </TD>
                        <TD className="whitespace-nowrap">{formatDocument(r.document)}</TD>
                        <TD>
                          <Select value={r.type} onChange={(e) => setType(r.id, e.target.value as ContactType)} className="h-8 min-w-[130px]">
                            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </Select>
                        </TD>
                        <TD className="text-xs text-muted-foreground">{bankStr}</TD>
                        <TD><Button variant="ghost" size="sm" title="Remover" onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}><X className="h-4 w-4 text-destructive" /></Button></TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {rows.length === 0 && done === null && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground"><Users className="h-8 w-8" /><p className="text-sm">Escolha a planilha de favorecidos para começar.</p></CardContent></Card>
      )}
    </div>
  )
}
