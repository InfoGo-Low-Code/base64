import crypto from 'crypto'

export function createSmartKey(r: any, recibo_parcela: string) {
  const codigo = r.codigo_identificacao ?? ''
  const valor = String(r.valor ?? '')
  const parcela =
    recibo_parcela &&
    recibo_parcela.trim() !== '?' &&
    recibo_parcela !== '-' ?
    recibo_parcela : ''

  const data_credito =
    r.data_vencimento &&
    String(r.data_vencimento).trim() !== '?' &&
    String(r.data_vencimento).trim() === '-' ?
    r.data_vencimento : ''

  const cliente =
    r.cliente &&
    r.cliente.trim() !== '?' &&
    r.cliente.trim() !== '-' ?
    r.cliente : ''

  const parcelaConcat = parcela === '' ? '' : `|${parcela}`
  const dataCreditoConcat = data_credito === '' ? '' : `|${data_credito}`
  const clienteConcat = cliente === '' ? '' : `| ${cliente}`

  const empresa = r.empresa ?? ''

  // Chave mínima e estável
  const base = `${codigo}|${valor}|${empresa}${parcelaConcat}${dataCreditoConcat}${clienteConcat}`

  return crypto
    .createHash("sha256")
    .update(base)
    .digest("hex")
}
