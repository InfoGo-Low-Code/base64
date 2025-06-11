import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { basename, extname } from 'node:path'

export function urlFileToBase64(app: FastifyZodTypedInstance) {
  app.post(
    '/urlFileToBase64',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
        }),
        response: {
          200: z.object({
            contentType: z.string(),
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

        const filename = basename(new URL(url).pathname)

        const extension = extname(filename).replace('.', '').toLowerCase()

        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico']

        const contentType = imageExtensions.includes(extension)
          ? `image/${extension === 'jpg' ? 'jpeg' : extension}`
          : `application/${extension}`

        const base64String = Buffer.from(data).toString('base64')

        return reply.send({
          contentType,
          base64: base64String,
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
