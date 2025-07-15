import { z } from 'zod'

export const produtoSimilarSchema = z.object({
  Produto: z.string(),
  CodigoProdutoSimilar: z.string(),
  Descricao: z.string(),
  Comercializado: z.boolean(),
})

export type ProdutoSimilarSchema = z.infer<typeof produtoSimilarSchema>
