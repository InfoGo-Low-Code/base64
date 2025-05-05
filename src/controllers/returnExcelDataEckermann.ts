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

import { readFile, utils } from 'xlsx'
import { planilhaHoEckermannResponse, PlanilhaHoEckermannResponse } from '@/schemas/planilhaHoEckermannResponse'
import { PlanilhaHoEckermannBody } from '@/schemas/planilhaHoEckermannBody'
import { randomUUID } from 'node:crypto'
import { returnExcelDataBodySchema } from '@/schemas/returnExcelDataBodySchema'
import { excelDateToJSDate } from '@/utils/parseXlsxDate'

export function returnExcelDataEckermann(app: FastifyZodTypedInstance) {
  app.post(
    '/returnExcelDataEckermann',
    {
      schema: {
        response: {
          200: z.object({
            register_amount: z.number(),
            excel: z.array(planilhaHoEckermannResponse),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const file = await request.file()

      const { empresa: { value: empresa } } = returnExcelDataBodySchema.parse(file?.fields)

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
        const workbook = readFile(filePath)
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const dataXlsx: PlanilhaHoEckermannBody[] = utils.sheet_to_json(worksheet, {
          header: [
            'CLIENTE',
            'CARTEIRA',
            'DESCRIÇÃO DOS HONORÁRIOS',
            'DATA DO CRÉDITO',
            'CÓDIGO/NOME DE IDENTIFICAÇÃO',
            'VALOR',
            'N. DO RECIBO/PARCELA',
            'DATA',
            'PAGO',
            'FONTE PAGADORA',
            'BANCO',
            'SÓCIO'
          ],
          range: 1
        })

        const slicedDataXlsx = dataXlsx.slice(0, -3)

        const excel: PlanilhaHoEckermannResponse[] = slicedDataXlsx.map((line) => {
          const data_pagamento = line.DATA ? excelDateToJSDate(line.DATA) : 'Não informado'
          const data_vencimento =
            typeof line['DATA DO CRÉDITO'] === 'number'
              ? excelDateToJSDate(line['DATA DO CRÉDITO'])
              : 'Não informado'

          const formattedLine = {
            id: randomUUID(),
            cliente: line.CLIENTE,
            carteira: line.CARTEIRA,
            descricao_honorario: line['DESCRIÇÃO DOS HONORÁRIOS'],
            data_vencimento,
            codigo_identificacao: line['CÓDIGO/NOME DE IDENTIFICAÇÃO'],
            valor: line.VALOR,
            recibo_parcela: line['N. DO RECIBO/PARCELA'],
            status: line.PAGO === 'OK' ? 'PAGO' : 'PENDENTE',
            fonte_pagadora: line['FONTE PAGADORA'],
            banco: line.BANCO ? line.BANCO : 'Não informado',
            data_pagamento,
            socio: line.SOCIO ? line.SOCIO : 'Não informado',
            empresa,
          }

          return formattedLine
        })

        unlinkSync(filePath)

        const register_amount = excel.length

        return reply.send({ register_amount, excel })
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
