import crypto from "crypto";

export function createSmartKey(r: any) {
  const codigo = r.codigo_identificacao ?? ''
  const valor = String(r.valor ?? '')
  const empresa = r.empresa ?? ''

  // Chave mínima e estável
  const base = `${codigo}|${valor}|${empresa}`

  return crypto
    .createHash("sha256")
    .update(base)
    .digest("hex")
}
