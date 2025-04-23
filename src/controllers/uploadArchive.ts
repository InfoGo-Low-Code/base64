import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'

import {
  existsSync,
  createWriteStream,
  mkdirSync,
  readFileSync,
  unlinkSync,
} from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

export function uploadArchive(app: FastifyZodTypedInstance) {
  app.post(
    '/upload',
    {
      schema: {
        response: {
          201: z.null().describe('Archive uploaded and created data'),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const file = await request.file()
      const filename = file?.filename

      if (!file || file.filename === '') {
        return reply.status(400).send({
          statusCode: 400,
          message: 'File is missing',
          details: [
            {
              path: ['file'],
              message: 'Expected "file" received "undefined"',
            },
          ],
        })
      }

      if (!existsSync('./uploads')) {
        mkdirSync('./uploads', { recursive: true })
      }

      const filePath = `./uploads/${file.filename}`
      await pipeline(file.file, createWriteStream(filePath))

      try {
        const fileData = readFileSync(filePath)
        const base64String = Buffer.from(fileData).toString('base64')

        await app.axios.post('/receive_excel', {
          filename,
          excel: base64String
        })

        unlinkSync(filePath)

        return reply.status(201).send()
      } catch (error) {
        unlinkSync(filePath)

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
