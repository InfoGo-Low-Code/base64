import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'

import { readFile, utils } from 'xlsx'
import { basename } from 'node:path'

import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import {
  ProdutoSimilarResponseSchema,
  produtoSimilarResponseSchema,
} from '@/utils/cofap/parserCodigoSimilar'
import { ProdutoSimilarSchema } from '@/schemas/cofap/infocode/produtoSimilarSchema'

export function cofapComunizados(app: FastifyZodTypedInstance) {
  app.post(
    '/cofap/comunizados',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
        }),
        response: {
          200: z.object({
            quantidade_registros: z.number(),
            produtos: z.array(produtoSimilarResponseSchema),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { url } = request.body

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

        const workbook = readFile(filePath)
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]

        const dataXlsx: ProdutoSimilarSchema[] = utils.sheet_to_json(
          worksheet,
          {
            header: [
              'Produto',
              'CodigoProdutoSimilar',
              'Descricao',
              'Comercializado',
            ],
            range: 1,
          },
        )

        const produtos: ProdutoSimilarResponseSchema[] = dataXlsx.flatMap(
          ({ Produto, CodigoProdutoSimilar, Descricao, Comercializado }) => {
            return {
              Produto: String(Produto),
              CodigoProdutoSimilar: String(CodigoProdutoSimilar),
              Descricao: String(Descricao),
              Comercializado: !Comercializado ? 'FALSO' : 'VERDADEIRO',
            }
          },
        )

        unlinkSync(filePath)

        const quantidade_registros = produtos.length

        return reply.send({ quantidade_registros, produtos })
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
