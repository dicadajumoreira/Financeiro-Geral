// Consulta de CNPJ via BrasilAPI (roda no navegador do usuário; tem CORS liberado).
// Doc: https://brasilapi.com.br/docs#tag/CNPJ

export interface CNPJData {
  razaoSocial: string
  nomeFantasia: string
  email: string
  telefone: string
  taxRegime: string | null
  address: {
    cep?: string
    logradouro?: string
    numero?: string
    bairro?: string
    municipio?: string
    uf?: string
  }
}

export function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '')
}

export function isCNPJ(s: string | null | undefined): boolean {
  return onlyDigits(s).length === 14
}

export async function fetchCNPJ(raw: string): Promise<CNPJData> {
  const digits = onlyDigits(raw)
  if (digits.length !== 14) throw new Error('CNPJ deve ter 14 dígitos.')

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
  if (res.status === 404) throw new Error('CNPJ não encontrado.')
  if (!res.ok) throw new Error('Não foi possível consultar o CNPJ agora.')
  const d = await res.json()

  const tel = d.ddd_telefone_1 ? String(d.ddd_telefone_1).trim() : ''
  const simples = d.opcao_pelo_simples === true || d.opcao_pelo_mei === true
  return {
    razaoSocial: (d.razao_social || '').toUpperCase(),
    nomeFantasia: (d.nome_fantasia || '').toUpperCase(),
    email: (d.email || '').toLowerCase(),
    telefone: tel,
    taxRegime: d.opcao_pelo_mei ? 'MEI' : simples ? 'Simples Nacional' : null,
    address: {
      cep: d.cep ? String(d.cep) : undefined,
      logradouro: d.logradouro || undefined,
      numero: d.numero ? String(d.numero) : undefined,
      bairro: d.bairro || undefined,
      municipio: d.municipio || undefined,
      uf: d.uf || undefined,
    },
  }
}
