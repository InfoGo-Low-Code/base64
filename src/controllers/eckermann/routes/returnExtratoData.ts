import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

import { basename } from 'node:path'
import { parserBb } from '@/utils/eckermann/parserBb'
import { ExtratoSchema, extratoSchema } from '@/schemas/eckermann/extratoSchema'
import { parserBradesco } from '@/utils/eckermann/parserBradesco'
import { parserItau } from '@/utils/eckermann/parserItau'
import { parserSantander } from '@/utils/eckermann/parserSantander'

export function returnExtratoData(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/returnExtratoData',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
          empresa: z.string(),
          banco: z.enum(['BANCO DO BRASIL', 'BRADESCO', 'SANTANDER', 'ITAÚ']),
        }),
        response: {
          200: z.object({
            registros: z.array(z.union([z.any(), extratoSchema])),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { empresa, url, banco } = request.body

      if (!existsSync('./uploads')) {
        mkdirSync('./uploads', { recursive: true })
      }

      try {
        const { data } = await app.axios.get(url, {
          responseType: 'arraybuffer',
        })

        const filename = basename(new URL(url).pathname)
        const filePath = `./uploads/${filename}`

        writeFileSync(filePath, data)

        let registros: ExtratoSchema[]

        if (banco === 'BANCO DO BRASIL') {
          registros = parserBb(filePath, empresa, filename)
        } else if (banco === 'BRADESCO') {
          registros = parserBradesco(filePath, empresa, filename)
        } else if (banco === 'ITAÚ') {
          registros = parserItau(filePath, empresa, filename)
        } else {
          registros = parserSantander(filePath, empresa, filename)
        }

        unlinkSync(filePath)

        return reply.send({ registros })
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
