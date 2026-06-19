import { useOrg } from '@/contexts/OrgContext'
import { Select } from '@/components/ui/select'

/** Seletor de empresa no topo. Valor vazio = visão consolidada (todas). */
export function CompanySwitcher() {
  const { companies, currentCompany, setCurrentCompany } = useOrg()

  return (
    <Select
      value={currentCompany?.id ?? ''}
      onChange={(e) => {
        const id = e.target.value
        setCurrentCompany(id ? companies.find((c) => c.id === id) ?? null : null)
      }}
      className="max-w-[260px]"
    >
      <option value="">🏢 Todas as empresas (consolidado)</option>
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.trade_name || c.legal_name}
        </option>
      ))}
    </Select>
  )
}
