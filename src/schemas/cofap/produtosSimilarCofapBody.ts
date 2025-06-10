import { z } from 'zod'

export const produtosSimilarCofapBody = z.object({
  Produto: z.string(),
  CodigoProdutoSimilar: z.string(),
  Descricao: z.string(),
  Comercializado: z.boolean(),
})

export type ProdutosSimilarCofapBody = z.infer<typeof produtosSimilarCofapBody>
