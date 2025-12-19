export function parseNomeArquivo(nome: string):
  { data: string, pasta: string, valor: string } | null {
  // remove extensão
  const semExt = nome.replace(/\.pdf$/i, '').trim()

  // split bruto
  const parts = semExt.split('-').map(p => p.trim())

  if (parts.length < 3) {
    return null
  }

  // primeira parte sempre é data
  const data = parts[0]

  // última parte sempre é valor
  const valor = parts[parts.length - 1]

  // tudo entre data e valor é a pasta
  const pasta = parts.slice(1, -1).join('-').trim()

  return {
    data,
    pasta,
    valor,
  }
}
