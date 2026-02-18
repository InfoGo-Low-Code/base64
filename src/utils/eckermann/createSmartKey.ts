import crypto from "crypto";

export function createSmartKey(r: any, recibo_parcela: string) {
  const codigo = r.codigo_identificacao ?? ''
  const valor = String(r.valor ?? '')
  const parcela =
    recibo_parcela &&
    recibo_parcela.trim() !== '?' &&
    recibo_parcela !== '-' ?
    recibo_parcela : ''

  const empresa = r.empresa ?? ''

  // Chave mínima e estável
  const base = `${codigo}|${valor}|${empresa}|${parcela}`

  return crypto
    .createHash("sha256")
    .update(base)
    .digest("hex")
}
