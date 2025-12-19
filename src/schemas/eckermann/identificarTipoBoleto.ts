export type TipoBoleto = "ARRECADACAO" | "BOLETO_BANCARIO" | "DESCONHECIDO"

export function identificarTipoBoleto(codigoBarras: string): TipoBoleto {
  const banco = codigoBarras.substring(0, 1)

  // Arrecadação: começam com 8
  if (banco === "8") return "ARRECADACAO"

  // Boletos bancários possuem 3 primeiros dígitos = banco emissor
  if (/^\d{3}/.test(codigoBarras)) return "BOLETO_BANCARIO"

  return "DESCONHECIDO"
}
