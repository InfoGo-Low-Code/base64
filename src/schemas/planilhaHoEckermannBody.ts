import { z } from "zod";

export const planilhaHoEckermannBody = z.object({
  CLIENTE: z.string(),
  CARTEIRA: z.string(),
  "DESCRIÇÃO DOS HONORÁRIOS": z.string(),
  "DATA DO CRÉDITO": z.number(),
  "CÓDIGO/NOME DE IDENTIFICAÇÃO": z.string(),
  VALOR: z.number(),
  "N. DO RECIBO/PARCELA": z.string(),
  DATA: z.number().optional(),
  PAGO: z.string(),
  "FONTE PAGADORA": z.string(),
  BANCO: z.string().optional(),
  SOCIO: z.string().optional(),
})

export type PlanilhaHoEckermannBody = z.infer<typeof planilhaHoEckermannBody>
