import { z } from 'zod'

export const fastifyErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  error: z.string(),
})
