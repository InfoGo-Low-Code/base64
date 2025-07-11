import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

import { readFile, utils } from 'xlsx'
import {
  planilhaHoEckermannResponse,
  PlanilhaHoEckermannResponse,
} from '@/schemas/eckermann/planilhaHoEckermannResponse'
import { PlanilhaHoEckermannBody } from '@/schemas/eckermann/planilhaHoEckermannBody'
import { excelDateToJSDate } from '@/utils/parseXlsxDate'
import { basename } from 'node:path'
import { camposConcat } from '@/utils/camposConcat'

export function returnExcelDataEckermann(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/returnExcelDataEckermann',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
          empresa: z.string(),
        }),
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
      const { empresa, url } = request.body

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
        const dataXlsx: PlanilhaHoEckermannBody[] = utils.sheet_to_json(
          worksheet,
          {
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
              'SÓCIO',
            ],
            range: 1,
          },
        )

        const slicedDataXlsx = dataXlsx.slice(0, -3)

        const excel: PlanilhaHoEckermannResponse[] = slicedDataXlsx.flatMap(
          (line) => {
            const cliente =
              line.CLIENTE === '?' || !line.CLIENTE
                ? 'Não informado'
                : line.CLIENTE

            const carteira =
              line.CARTEIRA === '?' || !line.CARTEIRA
                ? 'Não informado'
                : line.CARTEIRA

            const descricao_honorario =
              line['DESCRIÇÃO DOS HONORÁRIOS'] === '?' ||
              !line['DESCRIÇÃO DOS HONORÁRIOS']
                ? 'Não informado'
                : line['DESCRIÇÃO DOS HONORÁRIOS']

            const data_pagamento = line.DATA
              ? excelDateToJSDate(line.DATA)
              : undefined

            const data_vencimento =
              typeof line['DATA DO CRÉDITO'] === 'number'
                ? excelDateToJSDate(line['DATA DO CRÉDITO'])
                : undefined

            const fonte_pagadora =
              line['FONTE PAGADORA'] === '?'
                ? 'Não informado'
                : line['FONTE PAGADORA']

            const recibo_parcela =
              line['N. DO RECIBO/PARCELA'] === '?' ||
              !line['N. DO RECIBO/PARCELA']
                ? 'Não informado'
                : line['N. DO RECIBO/PARCELA']

            const baseObject = {
              cliente,
              carteira,
              descricao_honorario,
              data_vencimento,
              codigo_identificacao: line['CÓDIGO/NOME DE IDENTIFICAÇÃO'],
              valor: line.VALOR,
              status: line.PAGO === 'OK' ? 'PAGO' : 'PENDENTE',
              fonte_pagadora,
              banco: line.BANCO ? line.BANCO : 'Não informado',
              data_pagamento,
              socio: line.SOCIO ? line.SOCIO : 'Não informado',
              empresa,
              valor_validado: 0,
            }

            if (recibo_parcela.includes('/')) {
              const [primeiraParcela, segundaParcela] =
                recibo_parcela.split('/')

              return Array.from(
                {
                  length: Number(segundaParcela) - Number(primeiraParcela) + 1,
                },
                (_, idx) => {
                  const vencimento = baseObject.data_vencimento
                    ? new Date(baseObject.data_vencimento)
                    : undefined

                  const pagamento =
                    idx === 0 ? baseObject.data_pagamento : undefined

                  if (vencimento) {
                    vencimento.setUTCMonth(vencimento.getUTCMonth() + idx)
                  }

                  const recibo_parcela = `${Number(primeiraParcela) + idx}/${segundaParcela}`

                  return {
                    ...baseObject,
                    id: camposConcat(baseObject, recibo_parcela),
                    data_vencimento: vencimento,
                    recibo_parcela,
                    data_pagamento: pagamento,
                  }
                },
              )
            }

            if (
              recibo_parcela !== '?' &&
              recibo_parcela !== '-' &&
              recibo_parcela !== 'A DEFINIR'
            ) {
              return Array.from({ length: 12 }, (_, idx) => {
                const vencimento = baseObject.data_vencimento
                  ? new Date(baseObject.data_vencimento)
                  : undefined

                if (vencimento) {
                  vencimento.setUTCMonth(vencimento.getUTCMonth() + idx)
                }

                const pagamento =
                  idx === 0 ? baseObject.data_pagamento : undefined

                const recibo_parcela_formatado = `${recibo_parcela}-${idx+1}/${12}`

                return {
                  ...baseObject,
                  id: camposConcat(baseObject, recibo_parcela_formatado),
                  data_vencimento: vencimento,
                  recibo_parcela: recibo_parcela_formatado,
                  data_pagamento: pagamento,
                }
              })
            }

            return {
              ...baseObject,
              id: camposConcat(baseObject, recibo_parcela),
              recibo_parcela,
            }
          },
        )

        unlinkSync(filePath)

        const register_amount = excel.length

        return reply.send({ register_amount, excel })
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
