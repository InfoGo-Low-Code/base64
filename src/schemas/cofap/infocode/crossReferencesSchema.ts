import { z } from 'zod'

export const crossReferencesSchema = z.object({
  Produto: z.string(),
  DescFabricante: z.string(),
  NumeroProdutoPesq: z.string(),
})

export type CrossReferencesSchema = z.infer<typeof crossReferencesSchema>
