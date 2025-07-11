import { z } from "zod";

export const extratoSchema = z.object({
  id: z.string(),
  data: z.string(),
  descricao: z.string(),
  valor: z.number(),
  nome_relatorio: z.string(),
  banco: z.string(),
  status: z.number(),
  status_texto: z.string(),
  empresa: z.string(),
  tipo_transacao: z.string(),
})

export type ExtratoSchema = z.infer<typeof extratoSchema>
