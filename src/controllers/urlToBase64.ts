import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

export function urlToBase64(app: FastifyZodTypedInstance) {
  app.post(
    '/urlToBase64',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
        }),
        response: {
          200: z.object({
            base64: z.string(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { url } = request.body

      try {
        const { data } = await app.axios.get(url, {
          responseType: 'arraybuffer',
        })

        const base64String = Buffer.from(data).toString('base64')

        return reply.send({ base64: base64String })
      } catch (error) {
        if (hasZodFastifySchemaValidationErrors(error)) {
          const formattedErrors = error.validation.map((validation) => {
            return validation.params.issue
          })

          return reply.status(400).send({
            statusCode: 400,
            message: 'Validation fields failed',
            details: formattedErrors,
          })
        } else {
          return reply.internalServerError(String(error))
        }
      }
    },
  )
}
