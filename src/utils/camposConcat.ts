export function camposConcat(base: any, recibo_parcela: string): string {
  console.log(recibo_parcela)
  const valores = [
    base.cliente,
    base.carteira,
    base.descricao_honorario,
    base.data_vencimento?.toISOString?.() || '',
    base.codigo_identificacao,
    base.valor,
    recibo_parcela,
    base.status,
    base.fonte_pagadora,
    base.banco,
    base.data_pagamento?.toISOString?.() || '',
    base.socio,
    base.empresa,
  ]
  return valores.join('&')
}