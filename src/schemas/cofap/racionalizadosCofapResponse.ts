import { z } from 'zod'

export const racionalizadosCofapResponse = z.object({
  Produto: z.string(),
  CodigoProduto: z.string(),
  Descricao: z.string(),
  Comercializado: z.string(),
})

export type RacionalizadosCofapResponse = z.infer<
  typeof racionalizadosCofapResponse
>
