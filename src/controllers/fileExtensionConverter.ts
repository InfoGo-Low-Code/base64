import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import ConvertAPI from 'convertapi'
import { env } from '@/env'
import { lookup, extension } from 'mime-types'
import { extname } from 'node:path'
import { unlink, writeFile } from 'node:fs/promises'

export function fileExtensionConverter(app: FastifyZodTypedInstance) {
  app.post(
    '/fileExtensionConverter',
    {
      schema: {
        body: z.object({
          url: z.string().url().optional(),
          filename: z.string(),
          extensionConvert: z.string(),
          base64: z.string().optional(),
        }),
        response: {
          200: z.object({
            url: z.string(),
            mimetype: z.string(),
            filename: z.string(),
            base64: z.string(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { url, filename, extensionConvert, base64: base64File } = request.body

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

      let filePath = `./uploads/${filename}`

      if (base64File) {
        const base64Data = base64File.includes(',')
          ? base64File.split(',')[1]
          : base64File

        const buffer = Buffer.from(base64Data, 'base64')

        await writeFile(filePath, buffer)
      }

      try {
        const result = await convertapi.convert(
          extensionConvert,
          {
            File: base64File ? filePath : url,
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
          url: urlConverted,
          mimetype: contentType,
          filename: `${filenameWithoutExt}.${extensionConvert}`,
          base64,
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
      } finally {
        unlink(filePath)
      }
    },
  )
}
