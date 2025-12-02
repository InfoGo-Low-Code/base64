import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { basename, extname } from 'node:path'
import { lookup } from 'mime-types'
import { setUserUsage } from '@/utils/audisa/routeUsage'

export function urlFileToBase64(app: FastifyZodTypedInstance) {
  app.post(
    '/urlFileToBase64',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
          nomeArquivo: z.string().optional(),
          user: z.string().optional(),
        }),
        response: {
          200: z.object({
            contentType: z.union([z.string(), z.boolean()]),
            base64: z.string(),
            nomeArquivo: z.string().optional(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { url, nomeArquivo, user } = request.body

      user && setUserUsage(user)

      try {
        const { data } = await app.axios.get(url, {
          responseType: 'arraybuffer',
        })

        const filename = basename(new URL(url).pathname)

        const extension = extname(filename).replace('.', '').toLowerCase()

        const contentType = lookup(extension)

        const base64String = Buffer.from(data).toString('base64')

        return reply.send({
          contentType,
          base64: base64String,
          nomeArquivo,
        })
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
