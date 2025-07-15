import { z } from 'zod'

export const produtosSchema = z.object({
  Marca: z.string(),
  Linha: z.string(),
  Produto: z.string(),
  Posição: z.string(),
  Obs: z.string(),
  Comercializado: z.boolean(),
  Site: z.string(),
})

export type ProdutosSchema = z.infer<typeof produtosSchema>
