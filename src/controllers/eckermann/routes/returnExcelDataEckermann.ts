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
          500: fastifyErrorResponseSchema.extend({
            detailedError: z.string(),
            valorEsperado: z.string().optional(),
            valorRecebido: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { empresa, url } = request.body

      if (!existsSync('./uploads')) {
        mkdirSync('./uploads', { recursive: true })
      }

      let filePath = ''
      
      // Armazenamento para IDs únicos e duplicados
      const seenIds = new Set<string>()
      const duplicateIdsArray: string[] = []
      const uniqueExcel: PlanilhaHoEckermannResponse[] = []
      
      let mensagemErro = ''
      let valorEsperado = undefined
      let valorRecebido = ''

      try {
        let linhaAtual = 0
        let campoAtual = ''

        const { data } = await app.axios.get(url, {
          responseType: 'arraybuffer',
        })

        const filename = basename(new URL(url).pathname)
        filePath = `./uploads/${filename}`

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
              'OBS',
              'SÓCIO',
              'VALOR VALIDADO'
            ],
            range: 1,
            blankrows: false,
          },
        )

        const semDuplicados = Array.from(
          new Map(
            dataXlsx.map((row) => [JSON.stringify(row), row])
          ).values()
        )

        semDuplicados.forEach((line, index) => {
          // define a linha real na planilha
          linhaAtual = index + 2 // header na linha 1 → range inicia na linha 2

          try {
            // === CLIENTE === //
            campoAtual = 'CLIENTE'
            const cliente =
              !line.CLIENTE
              || line.CLIENTE.trim() === ''
                ? '?'
                : String(line.CLIENTE.trim())


            // === CARTEIRA === //
            campoAtual = 'CARTEIRA'

            const validCarteira = new Set([
              'AMBOS',
              'CASOS ATIVOS',
              'CASOS PASSIVOS',
              'CONTENCIOSO',
              'INTERNO',
              'PF',
              'REPASSE',
              'TRABALHISTA',
              'ESTRUTURADOS',
              'TRT',
            ])

            const rawCarteira = line['CARTEIRA']

            if (!rawCarteira || rawCarteira === '?') {
              var carteira = '?'
            } else {
              // Caso tenha valor, validar
              if (!validCarteira.has(rawCarteira.trim())) {
                valorEsperado = 'AMBOS, CASOS ATIVOS, CASOS PASSIVOS, CONTENSIOSO, INTERNO, PF, REPASSE'
                valorRecebido = rawCarteira
                throw new Error('Valor inválido no campo CARTEIRA')
              }
              var carteira = rawCarteira.trim()
            }


            // === DESCRIÇÃO DOS HONORÁRIOS === //
            const rawHonorario = line['DESCRIÇÃO DOS HONORÁRIOS']

            if (!rawHonorario || rawHonorario === '?') {
              var descricao_honorario = '?'
            } else {
              var descricao_honorario = rawHonorario.trim()
            }



            // === DATA === //
            campoAtual = 'DATA'
            let data_pagamento
            if (typeof line.DATA === 'number') {
              excelDateToJSDate(line.DATA)
            } else if (!line.DATA || line.DATA.trim() === '' || line.DATA === 'PENDENTE' || line.DATA === '?' || !line.DATA?.includes('/')) {
              data_pagamento = undefined
            } else {
              try {
                data_pagamento = excelDateToJSDate(line.DATA.trim())
              } catch {
                valorRecebido = line.DATA.trim()
                throw new Error('Valor inválido no campo DATA')
              }
            }



            // === DATA DO CRÉDITO === //
            campoAtual = 'DATA DO CRÉDITO'
            let data_vencimento
            if (typeof line['DATA DO CRÉDITO'] === 'number') {
              excelDateToJSDate(line['DATA DO CRÉDITO'])
            } else if (!line['DATA DO CRÉDITO'] || line['DATA DO CRÉDITO'].trim() === '' || line['DATA DO CRÉDITO'] === 'PENDENTE' || line['DATA DO CRÉDITO'] === '?' || !line['DATA DO CRÉDITO']?.includes('/')) {
              data_vencimento = undefined
            } else {
              try {
                data_vencimento = excelDateToJSDate(line['DATA DO CRÉDITO'].trim())
              } catch {
                valorRecebido = line['DATA DO CRÉDITO'].trim()
                throw new Error('Valor inválido no campo DATA DO CRÉDITO')
              }
            }



            // === FONTE PAGADORA === //
            campoAtual = 'FONTE PAGADORA'
            const validFontePagadora = new Set([
              'CLIENTE',
              'DEVEDOR',
              'FORNECEDOR',
            ])

            const rawFontePagadora = line['FONTE PAGADORA']

            if (!rawFontePagadora || rawFontePagadora === '?') {
              var fonte_pagadora = '?'
            } else {
              // Caso tenha valor, validar
              if (!validFontePagadora.has(rawFontePagadora)) {
                valorRecebido = rawFontePagadora.trim()
                throw new Error('Valor inválido no campo FONTE PAGADORA')
              }
              var fonte_pagadora = rawFontePagadora.trim()
            }

            
            // === RECIBO/PARCELA === //
            campoAtual = 'N. DO RECIBO/PARCELA'
            const recibo_parcela =
              !line['N. DO RECIBO/PARCELA']
              || line['N. DO RECIBO/PARCELA'].trim() === ''
                ? '?'
                : String(line['N. DO RECIBO/PARCELA'].trim())



            // === VALOR VALIDADO === //
            campoAtual = 'VALOR VALIDADO'
            const mapValorValidado: Record<string, number> = {
              'SIM': 1,
              'NÃO': 0,
            }

            if (!line['VALOR VALIDADO'] || line['VALOR VALIDADO'].trim() === '') {
              var valor_validado = 0
            } else if (!(line['VALOR VALIDADO'].trim() in mapValorValidado)) {
              throw new Error('Valor inválido no campo VALOR VALIDADO')
            } else {
              var valor_validado = mapValorValidado[line['VALOR VALIDADO']]
            }




            // === OBS === //
            campoAtual = 'OBS'
            const obs = !line.OBS || line.OBS === '' ? undefined : String(line.OBS)



            // === BANCO === //
            campoAtual = 'BANCO'
            const validBanco = new Set([
              'BANCO DO BRASIL',
              'BRADESCO',
              'ITAÚ',
              'SANTANDER',
            ])

            const rawBanco = line['BANCO']

            if (!rawBanco || rawBanco === '') {
              var banco = 'NÃO INFORMADO'
            } else {
              // Caso tenha valor, validar
              if (!validBanco.has(rawBanco)) {
                valorRecebido = rawBanco.trim()
                valorEsperado = 'BANCO DO BRASIL, BRADESCO, ITAÚ, SANTANDER'
                throw new Error('Valor inválido no campo BANCO')
              }
              var banco = rawBanco.trim()
            }



            // === SOCIO === //
            campoAtual = 'SOCIO'
            const socio = line.SOCIO ? line.SOCIO.trim() : 'NÃO INFORMADO'


            
            // === CÓDIGO/NOME DE IDENTIFICAÇÃO === //
            campoAtual = 'CÓDIGO/NOME DE IDENTIFICAÇÃO'

            if (!line['CÓDIGO/NOME DE IDENTIFICAÇÃO'] || line['CÓDIGO/NOME DE IDENTIFICAÇÃO'].trim() === '') {
              valorRecebido =
                line['CÓDIGO/NOME DE IDENTIFICAÇÃO']
                && line['CÓDIGO/NOME DE IDENTIFICAÇÃO'].trim() !== ''
                  ? line['CÓDIGO/NOME DE IDENTIFICAÇÃO'].trim()
                  : ''
              throw new Error('Valor inválido no campo CÓDIGO/NOME DE IDENTIFICAÇÃO')
            } else {
              var codigo_identificacao = line['CÓDIGO/NOME DE IDENTIFICAÇÃO']
            }



            // === VALOR === //
            campoAtual = 'VALOR'
            let valor = 0
            if (!line.VALOR) {
              valor = 0
            } else if (typeof line.VALOR !== 'number') {
              valor = Number(line.VALOR)

              if (isNaN(valor)) {
                valorRecebido = line.VALOR
                throw new Error('Valor inválido no campo VALOR')
              }
            } else {
              valor = Number(line.VALOR.toString().replace(/\./g, '').replace(',', '.'))
            }



            // === STATUS === //
            campoAtual = 'PAGO'
            
            const mapStatus: Record<string, string> = {
              'OK': 'PAGO',
              'PAGO': 'PAGO',
              'PENDENTE': 'PENDENTE'
            }

            if (!line['PAGO'] || !(line['PAGO'] in mapStatus)) {
              valorRecebido = line['PAGO'] ? line['PAGO'] : ''
              throw new Error('Valor inválido no campo VALOR VALIDADO')
            }

            const status = mapStatus[line['PAGO']]

            // monta o objeto final
            const baseObject = {
              cliente,
              carteira,
              descricao_honorario,
              data_vencimento,
              codigo_identificacao,
              valor,
              status,
              fonte_pagadora,
              banco,
              data_pagamento,
              socio,
              obs,
              empresa,
              valor_validado,
            }

            campoAtual = 'ID'
            const registroFinal = {
              ...baseObject,
              id: camposConcat(baseObject, recibo_parcela),
              recibo_parcela,
            }

            if (seenIds.has(registroFinal.id)) {
              duplicateIdsArray.push(registroFinal.id)
            } else {
              seenIds.add(registroFinal.id)
              uniqueExcel.push(registroFinal as PlanilhaHoEckermannResponse)
            }

          } catch (innerErr: any) {
            // transforma erro em mensagem clara
            mensagemErro = innerErr.message
            throw new Error(
              `Erro ao processar campo '${campoAtual}' na linha ${linhaAtual}`
            )
          }
        })

        const register_amount = uniqueExcel.length
        return reply.send({ register_amount, excel: uniqueExcel })

      } catch (error: any) {
        if (hasZodFastifySchemaValidationErrors(error)) {
          const formattedErrors = error.validation.map((validation) => {
            return validation.params.issue
          })

          return reply.status(400).send({
            statusCode: 400,
            message: 'Validation fields failed',
            details: formattedErrors,
          })
        }

        return reply.status(500).send({
            statusCode: 500,
            message: error.message,
            error: 'Internal Server Error',
            detailedError: mensagemErro,
            valorRecebido,
            valorEsperado,
        })
      } finally {
        if (filePath && existsSync(filePath)) {
          unlinkSync(filePath)
        }
      }
    },
  )
}
