import { z } from 'zod'

export const produtosSimilarCofapResponse = z.object({
  Produto: z.string(),
  CodigoProdutoSimilar: z.string(),
  Descricao: z.string(),
  Comercializado: z.string(),
})

export type ProdutosSimilarCofapResponse = z.infer<
  typeof produtosSimilarCofapResponse
>
