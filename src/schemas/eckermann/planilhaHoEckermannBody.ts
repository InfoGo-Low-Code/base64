import { z } from 'zod'

export const planilhaHoEckermannBody = z.object({
  CLIENTE: z.string().optional(),
  CARTEIRA: z.string().optional(),
  'DESCRIÇÃO DOS HONORÁRIOS': z.string().optional(),
  'DATA DO CRÉDITO': z.union([z.number(), z.string()]).optional(),
  'CÓDIGO/NOME DE IDENTIFICAÇÃO': z.string().optional(),
  VALOR: z.number().optional(),
  'N. DO RECIBO/PARCELA': z.string().optional(),
  DATA: z.union([z.number(), z.string()]).optional(),
  PAGO: z.string().optional(),
  'FONTE PAGADORA': z.string().optional(),
  BANCO: z.string().optional(),
  OBS: z.string().optional(),
  SOCIO: z.string().optional(),
  'VALOR VALIDADO': z.string().optional(),
})

export type PlanilhaHoEckermannBody = z.infer<typeof planilhaHoEckermannBody>
