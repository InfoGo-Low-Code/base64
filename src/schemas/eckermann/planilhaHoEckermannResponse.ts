import { z } from 'zod'

export const planilhaHoEckermannResponse = z.object({
  id: z.string(),
  cliente: z.string(),
  carteira: z.string(),
  descricao_honorario: z.string(),
  data_vencimento: z.date().optional(),
  codigo_identificacao: z.string(),
  valor: z.number(),
  recibo_parcela: z.string(),
  status: z.string(),
  fonte_pagadora: z.string(),
  banco: z.string(),
  data_pagamento: z.date().optional(),
  obs: z.string().optional(),
  socio: z.string(),
  empresa: z.string(),
  valor_validado: z.number(),
})

export type PlanilhaHoEckermannResponse = z.infer<
  typeof planilhaHoEckermannResponse
>
