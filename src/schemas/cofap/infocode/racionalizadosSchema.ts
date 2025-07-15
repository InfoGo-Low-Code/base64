import { z } from 'zod'

export const racionalizadosSchema = z.object({
  Produto: z.string(),
  CodigoProduto: z.string(),
  Descricao: z.string(),
  Comercializado: z.boolean(),
})

export type RacionalizadosSchema = z.infer<typeof racionalizadosSchema>
