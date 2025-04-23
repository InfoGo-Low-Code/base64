import { z } from 'zod'

export const zodErrorBadRequestResponseSchema = z.object({
  statusCode: z.number(),
  message: z.string().default('Validation fields failed'),
  details: z.array(
    z.object({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
    }),
  ),
})
