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

export function fileToBase64(app: FastifyZodTypedInstance) {
  app.post(
    '/fileToBase64',
    {
      schema: {
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
      const file = await request.file()

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

        return reply.send({ base64: base64String })
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
