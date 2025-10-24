import { z } from "zod"

export const tecnoJurisSchema = z.object({
  id: z.string(),
  cliente: z.string(),
  descricao: z.string(),
  data_formatada: z.string(),
  usuario: z.string(),
  pasta: z.string(),
  partesContrarias: z.string(),
  tipo: z.string(),
  unidade: z.string(),
  natureza: z.string(),
  valor: z.number(),
  efetivado: z.number(),
  faturado: z.number(),
})

export type TecnoJurisSchema = z.infer<typeof tecnoJurisSchema>