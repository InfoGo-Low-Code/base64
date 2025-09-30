import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import ConvertAPI from 'convertapi'
import { env } from '@/env'
import { lookup, extension } from 'mime-types'
import { extname } from 'node:path'

export function fileExtensionConverter(app: FastifyZodTypedInstance) {
  app.post(
    '/fileExtensionConverter',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
          filename: z.string(),
          extensionConvert: z.string(),
        }),
        response: {
          200: z.object({
            base64: z.string(),
            mimetype: z.string(),
            filename: z.string(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { url, filename, extensionConvert } = request.body

      const filenameWithoutExt = filename.split('.')[0]

      const extensionFile = extname(filename).replace('.', '')

      if (!extensionFile) {
        return reply.internalServerError('Arquivo com extensão inválida')
      }

      const contentType = lookup(extensionConvert)

      if (!contentType) {
        return reply.internalServerError('Extensão desejada inválida')
      }

      const { CONVERTAPI_SECRET } = env

      const convertapi = new ConvertAPI(CONVERTAPI_SECRET)

      try {
        const result = await convertapi.convert(
          extensionConvert,
          {
            File: url,
          },
          extensionFile,
        )

        const {
          file: { url: urlConverted },
        } = result

        const { data: fileConverted } = await app.axios.get(urlConverted, {
          responseType: 'arraybuffer',
        })

        const buffer = Buffer.from(fileConverted)

        const base64 = buffer.toString('base64')

        return reply.send({
          base64,
          mimetype: contentType,
          filename: `${filenameWithoutExt}.${extensionConvert}`,
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
