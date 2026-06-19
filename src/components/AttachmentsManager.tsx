import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Trash2, Upload, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Attachment, AttachmentKind } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'

const BUCKET = 'attachments'

const KIND_LABEL: Record<AttachmentKind, string> = {
  comprovante: 'Comprovante',
  nota_fiscal: 'Nota Fiscal',
  boleto: 'Boleto',
  contrato: 'Contrato',
  outro: 'Outro',
}

export function AttachmentsManager({
  orgId,
  transactionId,
  canWrite,
}: {
  orgId: string
  transactionId: string
  canWrite: boolean
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<AttachmentKind>('comprovante')
  const [error, setError] = useState<string | null>(null)

  const key = ['attachments', transactionId]
  const { data: items, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Attachment[]
    },
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = `${orgId}/${transactionId}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
      if (upErr) throw upErr
      const { error: insErr } = await supabase.from('attachments').insert({
        org_id: orgId,
        transaction_id: transactionId,
        kind,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: user?.id ?? null,
      })
      if (insErr) throw insErr
    },
    onSuccess: async () => {
      setError(null)
      if (fileRef.current) fileRef.current.value = ''
      await qc.invalidateQueries({ queryKey: key })
    },
    onError: (e) => setError((e as Error).message),
  })

  const remove = useMutation({
    mutationFn: async (att: Attachment) => {
      await supabase.storage.from(BUCKET).remove([att.storage_path])
      const { error } = await supabase.from('attachments').delete().eq('id', att.id)
      if (error) throw error
    },
    onSuccess: async () => qc.invalidateQueries({ queryKey: key }),
  })

  async function openFile(att: Attachment) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(att.storage_path, 60)
    if (error) {
      setError(error.message)
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="space-y-3">
      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kind} onChange={(e) => setKind(e.target.value as AttachmentKind)} className="h-9 max-w-[170px]">
            {Object.entries(KIND_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload.mutate(f)
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />} Enviar arquivo
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {isLoading ? (
        <Spinner className="h-4 w-4" />
      ) : items && items.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((att) => (
            <li key={att.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <button className="flex-1 truncate text-left hover:underline" onClick={() => openFile(att)}>
                {att.file_name}
              </button>
              <Badge variant="secondary" className="shrink-0">
                {KIND_LABEL[att.kind]}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => openFile(att)} title="Baixar">
                <Download className="h-4 w-4" />
              </Button>
              {canWrite && (
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(att)} title="Excluir">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
      )}
    </div>
  )
}
