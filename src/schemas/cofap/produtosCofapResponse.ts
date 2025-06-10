import { z } from 'zod'

export const produtosCofapResponse = z.object({
  Marca: z.string(),
  Linha: z.string(),
  Produto: z.string(),
  Posição: z.string(),
  Obs: z.string(),
  Comercializado: z.string(),
  Site: z.string(),
})

export type ProdutosCofapResponse = z.infer<typeof produtosCofapResponse>
