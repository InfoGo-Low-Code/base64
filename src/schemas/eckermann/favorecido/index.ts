import { identificarTipoBoleto } from "../identificarTipoBoleto"
import { extrairFavorecidoArrecadacao } from "./extrairFavorecidoArrecadacao"
import { extrairFavorecidoBancario } from "./extrairFavorecidoBancario"
import { Favorecido } from "./extrairFavorecidoArrecadacao"

export function extrairFavorecido(
  parsedText: string,
  codigoBarras: string
): Favorecido | null {
  const tipo = identificarTipoBoleto(codigoBarras)

  // 1. Arrecadação
  if (tipo === "ARRECADACAO") {
    return extrairFavorecidoArrecadacao(codigoBarras)
  }

  // 2. Boleto bancário comum
  if (tipo === "BOLETO_BANCARIO") {
    const extraido = extrairFavorecidoBancario(parsedText)
    return extraido as Favorecido | null
  }

  return null
}
