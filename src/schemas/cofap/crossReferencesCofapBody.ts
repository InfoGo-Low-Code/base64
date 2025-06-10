import { z } from 'zod'

export const crossReferencesCofapBody = z.object({
  Produto: z.string(),
  DescFabricante: z.string(),
  NumeroProdutoPesq: z.string(),
})

export type CrossReferencesCofapBody = z.infer<typeof crossReferencesCofapBody>
