import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'

export function eckermannTecnoJuris(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/tecnoJuris',
    {
      schema: {
        body: z.object({
          query: z.any(),
        }),
        response: {
          200: z.any(),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {},
  )
}
