export function camposConcat(base: any, recibo_parcela: string): string {
  const valores = [
    base.cliente,
    base.carteira,
    base.descricao_honorario,
    base.data_vencimento?.toISOString?.() || '',
    base.codigo_identificacao,
    base.valor,
    recibo_parcela,
    base.fonte_pagadora,
    base.socio,
    base.empresa,
  ]

  const stringConcat = valores.join('&')

  const hash = stringConcat
  return hash.replace(/;/g, "")
}
