export type Favorecido = {
  nome: string
  cnpj: string
  banco: string
  agencia: string
  conta: string
  dv: string
  tipo: "CPF" | "CNPJ"
}

const orgaos: Record<string, Favorecido> = {
  // TJSP - FEDTJ (código 68)
  "68": {
    nome: "Fundo Especial de Despesa do Tribunal de Justiça – FEDTJ",
    cnpj: "46.175.981/0001-60",
    banco: "001",
    agencia: "0000",
    conta: "000000000",
    dv: "0",
    tipo: "CNPJ",
  },

  // DARF
  "21": {
    nome: "Receita Federal do Brasil",
    cnpj: "00.394.460/0053-39",
    banco: "001",
    agencia: "0000",
    conta: "000000000",
    dv: "0",
    tipo: "CNPJ",
  },

  // GRU
  "74": {
    nome: "Secretaria do Tesouro Nacional",
    cnpj: "00.394.460/0001-41",
    banco: "001",
    agencia: "0000",
    conta: "000000000",
    dv: "0",
    tipo: "CNPJ",
  },

  // Exemplo genérico para Banco do Brasil (8XX)
  "01": {
    nome: "Banco do Brasil - Arrecadação",
    cnpj: "00.000.000/0001-91",
    banco: "001",
    agencia: "0000",
    conta: "000000000",
    dv: "0",
    tipo: "CNPJ",
  }
}

export function extrairFavorecidoArrecadacao(codigo: string): Favorecido | null {
  const orgaoCodigo = codigo.substring(1, 3) // 2º e 3º dígito

  return orgaos[orgaoCodigo] ?? null
}
