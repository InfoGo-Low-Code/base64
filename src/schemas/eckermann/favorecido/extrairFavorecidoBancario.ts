import { Favorecido } from "./extrairFavorecidoArrecadacao"

export function extrairFavorecidoBancario(text: string): Partial<Favorecido> | null {
  let nome = ""
  let doc = ""
  
  // Nome do cedente
  const regexCedente = /(cedente|beneficiário|favorecido)[\s:]*([\w\s\.,\-\/&]+)/i
  const cedenteMatch = text.match(regexCedente)
  if (cedenteMatch) nome = cedenteMatch[2].trim()

  // CPF/CNPJ
  const regexCnpj = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;
  const regexCpf = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;

  const cnpj = text.match(regexCnpj)
  const cpf = text.match(regexCpf)

  if (cnpj) {
    doc = cnpj[0]
  } else if (cpf) {
    doc = cpf[0]
  }

  if (!nome && !doc) return null

  return {
    nome,
    cnpj: doc,
    tipo: cnpj ? "CNPJ" : "CPF",
    banco: "",
    agencia: "",
    conta: "",
    dv: "",
  }
}
