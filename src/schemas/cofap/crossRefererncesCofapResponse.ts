import { z } from 'zod'

export const crossReferencesCofapResponse = z.object({
  Produto: z.string(),
  DescFabricante: z.string(),
  NumeroProdutoPesq: z.string(),
})

export type CrossReferencesCofapResponse = z.infer<
  typeof crossReferencesCofapResponse
>
