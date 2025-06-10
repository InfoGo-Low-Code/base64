import { z } from 'zod'

export const produtosCofapBody = z.object({
  Marca: z.string(),
  Linha: z.string(),
  Produto: z.string(),
  Posição: z.string(),
  Obs: z.string(),
  Comercializado: z.string(),
  Site: z.string(),
})

export type ProdutosCofapBody = z.infer<typeof produtosCofapBody>
