import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'

import { readFile, utils } from 'xlsx'
import { basename } from 'node:path'

import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import {
  ProdutoResponseSchema,
  produtoResponseSchema,
} from '@/utils/cofap/parserProdutos'
import { ProdutosSchema } from '@/schemas/cofap/infocode/produtosSchema'

export function cofapProdutos(app: FastifyZodTypedInstance) {
  app.post(
    '/cofap/produtos',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
        }),
        response: {
          200: z.object({
            quantidade_registros: z.number(),
            produtos: z.array(produtoResponseSchema),
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

        const dataXlsx: ProdutosSchema[] = utils.sheet_to_json(worksheet, {
          header: [
            'Marca',
            'Linha',
            'Produto',
            'Posição',
            'Obs',
            'Comercializado',
            'Site',
          ],
          range: 1,
        })

        const produtos: ProdutoResponseSchema[] = dataXlsx.flatMap(
          ({ Marca, Linha, Produto, Posição, Obs, Comercializado, Site }) => {
            return {
              Marca: String(Marca),
              Linha: String(Linha),
              Produto: String(Produto),
              Posição: String(Posição),
              Obs: String(Obs),
              Comercializado: !Comercializado ? 'FALSO' : 'VERDADEIRO',
              Site: String(Site),
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
