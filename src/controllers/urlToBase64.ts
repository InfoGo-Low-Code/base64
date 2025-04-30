import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { basename } from 'node:path'

export function urlToBase64(app: FastifyZodTypedInstance) {
  app.post(
    '/urlToBase64',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
          banco: z.string()
        }),
        response: {
          200: z.object({
            base64: z.string(),
            filename: z.string(),
            banco: z.string(),
            status: z.number(),
            status_texto: z.string(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { url, banco } = request.body

      try {
        const { data } = await app.axios.get(url, {
          responseType: 'arraybuffer',
        })

        const filename = basename(new URL(url).pathname)

        const base64String = Buffer.from(data).toString('base64')

        const status = 0

        const status_texto = 'PENDENTE'

        return reply.send({ base64: base64String, filename, banco, status, status_texto })
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
