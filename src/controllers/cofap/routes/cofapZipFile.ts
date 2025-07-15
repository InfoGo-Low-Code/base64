import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'

import { basename } from 'node:path'

import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import AdmZip from 'adm-zip'
import { parserCrossReferences } from '@/utils/cofap/parserCrossReferences'
import {
  parserRacionalizados,
  RacionalizadosResponseSchema,
} from '@/utils/cofap/parserRacionalizados'
import {
  parserProdutos,
  ProdutoResponseSchema,
} from '@/utils/cofap/parserProdutos'
import {
  parserProdutoSimilar,
  ProdutoSimilarResponseSchema,
} from '@/utils/cofap/parserCodigoSimilar'
import { CrossReferencesSchema } from '@/schemas/cofap/infocode/crossReferencesSchema'
import { randomUUID } from 'node:crypto'

import { differenceInMilliseconds } from 'date-fns'

export function cofapZipFile(app: FastifyZodTypedInstance) {
  app.post(
    '/cofap/zipFile',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
        }),
        response: {
          200: z.object({
            message: z.string(),
            uuid: z.string(),
            racionalizados_time_in_ms: z.number(),
            comunizados_time_in_ms: z.number(),
            troca_codigo_time_in_ms: z.number(),
            versoes_time_in_ms: z.number(),
            cross_references_time_in_ms: z.number(),
            produtos_time_in_ms: z.number(),
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

        const zip = new AdmZip(filePath)
        const zipEntries = zip.getEntries()

        const racionalizados: RacionalizadosResponseSchema[] = []
        const comunizados: ProdutoSimilarResponseSchema[] = []
        const troca_codigo: ProdutoSimilarResponseSchema[] = []
        const versoes: ProdutoSimilarResponseSchema[] = []
        const cross_references: CrossReferencesSchema[] = []
        const produtos: ProdutoResponseSchema[] = []

        let racionalizados_time_in_ms: number = 0
        let comunizados_time_in_ms: number = 0
        let troca_codigo_time_in_ms: number = 0
        let versoes_time_in_ms: number = 0
        let cross_references_time_in_ms: number = 0
        let produtos_time_in_ms: number = 0

        for (const entry of zipEntries) {
          const startTime = new Date()

          if (!entry.entryName.endsWith('.xlsx')) continue

          const filenameWithoutExt = basename(
            entry.entryName,
            '.xlsx',
          ).toUpperCase()

          const entryBuffer = entry.getData()
          const tempFilePath = `./uploads/${entry.entryName}`
          writeFileSync(tempFilePath, entryBuffer)

          if (filenameWithoutExt.includes('RAC')) {
            racionalizados.push(...parserRacionalizados(tempFilePath))
            racionalizados_time_in_ms = differenceInMilliseconds(
              new Date(),
              startTime,
            )
          } else if (filenameWithoutExt.includes('CROSS')) {
            cross_references.push(...parserCrossReferences(tempFilePath))
            cross_references_time_in_ms = differenceInMilliseconds(
              new Date(),
              startTime,
            )
          } else if (filenameWithoutExt.includes('PRODUTOS')) {
            produtos.push(...parserProdutos(tempFilePath))
            produtos_time_in_ms = differenceInMilliseconds(
              new Date(),
              startTime,
            )
          } else if (filenameWithoutExt.includes('COM')) {
            comunizados.push(...parserProdutoSimilar(tempFilePath))
            comunizados_time_in_ms = differenceInMilliseconds(
              new Date(),
              startTime,
            )
          } else if (filenameWithoutExt.includes('TROCA')) {
            troca_codigo.push(...parserProdutoSimilar(tempFilePath))
            troca_codigo_time_in_ms = differenceInMilliseconds(
              new Date(),
              startTime,
            )
          } else if (filenameWithoutExt.includes('VERSOES')) {
            versoes.push(...parserProdutoSimilar(tempFilePath))
            versoes_time_in_ms = differenceInMilliseconds(new Date(), startTime)
          }

          unlinkSync(tempFilePath)
        }

        unlinkSync(filePath)

        const filenameJson = randomUUID()
        const jsonOutputPath = `./uploads/${filenameJson}.json`

        const jsonData = {
          racionalizados,
          comunizados,
          troca_codigo,
          versoes,
          cross_references,
          produtos,
        }

        writeFileSync(
          jsonOutputPath,
          JSON.stringify(jsonData, null, 2),
          'utf-8',
        )

        return reply.send({
          message: 'Arquivo processado',
          uuid: filenameJson,
          racionalizados_time_in_ms,
          comunizados_time_in_ms,
          troca_codigo_time_in_ms,
          versoes_time_in_ms,
          cross_references_time_in_ms,
          produtos_time_in_ms,
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
