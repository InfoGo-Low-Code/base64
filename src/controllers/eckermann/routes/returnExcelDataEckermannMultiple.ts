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
import { createSmartKey } from '@/utils/eckermann/createSmartKey'

export function returnExcelDataEckermannMultiple(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/returnExcelDataEckermannMultiple',
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
          422: fastifyErrorResponseSchema.extend({
            erros: z.array(z.object({
              linha: z.number(),
              campo: z.string(),
              mensagem: z.string(),
              valorRecebido: z.any().optional(),
              valorEsperado: z.any().optional(),
            })),
          }),
          500: fastifyErrorResponseSchema,
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
      
      let valorEsperado = undefined
      let valorRecebido = ''

      const erros: {
        linha: number
        campo: string
        mensagem: string
        valorRecebido?: any
        valorEsperado?: any
      }[] = []

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

          let carteira = ''
          if (!rawCarteira || rawCarteira === '?') {
            carteira = '?'
          } else {
            // Caso tenha valor, validar
            if (!validCarteira.has(rawCarteira.trim())) {
              valorEsperado = 'AMBOS, CASOS ATIVOS, CASOS PASSIVOS, CONTENSIOSO, INTERNO, PF, REPASSE'
              valorRecebido = rawCarteira
              erros.push({
                linha: linhaAtual,
                campo: campoAtual,
                mensagem: 'Valor inválido no campo CARTEIRA',
                valorRecebido,
                valorEsperado
              })
            } else {
              carteira = rawCarteira.trim()
            }
          }


          // === DESCRIÇÃO DOS HONORÁRIOS === //
          const rawHonorario = line['DESCRIÇÃO DOS HONORÁRIOS']

          let descricao_honorario = ''
          if (!rawHonorario || rawHonorario === '?') {
            descricao_honorario = '?'
          } else {
            descricao_honorario = rawHonorario.trim()
          }



          // === DATA === //
          campoAtual = 'DATA'
          let data_pagamento
          if (typeof line.DATA === 'number') {
            data_pagamento = excelDateToJSDate(line.DATA)
          } else if (!line.DATA || line.DATA.trim() === '' || line.DATA === 'PENDENTE' || line.DATA === '?' || !line.DATA?.includes('/')) {
            data_pagamento = undefined
          } else {
            try {
              data_pagamento = excelDateToJSDate(line.DATA.trim())
            } catch {
              valorRecebido = line.DATA.trim()

              erros.push({
                linha: linhaAtual,
                campo: campoAtual,
                mensagem: 'Valor inválido no campo DATA',
                valorRecebido,
                valorEsperado: undefined
              })
            }
          }



          // === DATA DO CRÉDITO === //
          campoAtual = 'DATA DO CRÉDITO'
          let data_vencimento
          if (typeof line['DATA DO CRÉDITO'] === 'number') {
            data_vencimento = excelDateToJSDate(line['DATA DO CRÉDITO'])
          } else if (!line['DATA DO CRÉDITO'] || line['DATA DO CRÉDITO'].trim() === '' || line['DATA DO CRÉDITO'] === 'PENDENTE' || line['DATA DO CRÉDITO'] === '?' || !line['DATA DO CRÉDITO']?.includes('/')) {
            data_vencimento = undefined
          } else {
            try {
              data_vencimento = excelDateToJSDate(line['DATA DO CRÉDITO'].trim())
            } catch {
              valorRecebido = line['DATA DO CRÉDITO'].trim()
              erros.push({
                linha: linhaAtual,
                campo: campoAtual,
                mensagem: 'Valor inválido no campo DATA DO CRÉDITO',
                valorRecebido,
                valorEsperado: undefined
              })
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

          let fonte_pagadora = ''
          if (!rawFontePagadora || rawFontePagadora === '?') {
            fonte_pagadora = '?'
          } else {
            // Caso tenha valor, validar
            if (!validFontePagadora.has(rawFontePagadora)) {
              valorRecebido = rawFontePagadora.trim()
              erros.push({
                linha: linhaAtual,
                campo: campoAtual,
                mensagem: 'Valor inválido no campo FONTE PAGADORA',
                valorRecebido,
                valorEsperado: undefined
              })
            }
            fonte_pagadora = rawFontePagadora.trim()
          }

          
          // === RECIBO/PARCELA === //
          campoAtual = 'N. DO RECIBO/PARCELA'
          const recibo_parcela =
            !line['N. DO RECIBO/PARCELA']
            || String(line['N. DO RECIBO/PARCELA']).trim() === ''
              ? '?'
              : String(line['N. DO RECIBO/PARCELA']).trim()



          // === VALOR VALIDADO === //
          campoAtual = 'VALOR VALIDADO'
          const mapValorValidado: Record<string, number> = {
            'SIM': 1,
            'NÃO': 0,
          }

          let valor_validado = 0

          if (!line['VALOR VALIDADO'] || line['VALOR VALIDADO'].trim() === '') {
            valor_validado = 0
          } else if (!(line['VALOR VALIDADO'].trim() in mapValorValidado)) {
            valorRecebido = line['VALOR VALIDADO']
            erros.push({
              linha: linhaAtual,
              campo: campoAtual,
              mensagem: 'Valor inválido no campo VALOR VALIDADO',
              valorRecebido,
              valorEsperado: undefined
            })
          } else {
            valor_validado = mapValorValidado[line['VALOR VALIDADO']]
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

          let banco = ''
          if (!rawBanco || rawBanco === '') {
            banco = 'NÃO INFORMADO'
          } else {
            // Caso tenha valor, validar
            if (!validBanco.has(rawBanco)) {
              valorRecebido = rawBanco.trim()
              valorEsperado = 'BANCO DO BRASIL, BRADESCO, ITAÚ, SANTANDER'
              erros.push({
                linha: linhaAtual,
                campo: campoAtual,
                mensagem: 'Valor inválido no campo BANCO',
                valorRecebido,
                valorEsperado
              })
            }
            banco = rawBanco.trim()
          }



          // === SOCIO === //
          campoAtual = 'SOCIO'
          const socio = line.SOCIO ? line.SOCIO.trim() : 'NÃO INFORMADO'


          
          // === CÓDIGO/NOME DE IDENTIFICAÇÃO === //
          campoAtual = 'CÓDIGO/NOME DE IDENTIFICAÇÃO'
          let codigo_identificacao = ''
          if (!line['CÓDIGO/NOME DE IDENTIFICAÇÃO'] || line['CÓDIGO/NOME DE IDENTIFICAÇÃO'].trim() === '') {
            valorRecebido =
              line['CÓDIGO/NOME DE IDENTIFICAÇÃO']
              && line['CÓDIGO/NOME DE IDENTIFICAÇÃO'].trim() !== ''
                ? line['CÓDIGO/NOME DE IDENTIFICAÇÃO'].trim()
                : ''
            
            erros.push({
              linha: linhaAtual,
              campo: campoAtual,
              mensagem: 'Valor inválido no campo CÓDIGO/NOME DE IDENTIFICAÇÃO',
              valorRecebido,
              valorEsperado: undefined
            })
          } else {
            codigo_identificacao = line['CÓDIGO/NOME DE IDENTIFICAÇÃO']
          }



          // === VALOR === //
          campoAtual = 'VALOR'
          let valor = 0
          if (!line.VALOR) {
            valor = 0
          } else if (typeof line.VALOR === 'string') {
            const raw = String(line.VALOR).toString().replace(/\./g, '').replace(',', '.')
            valor = Number(raw)

            if (isNaN(valor)) {
              valorRecebido = line.VALOR

              erros.push({
                linha: linhaAtual,
                campo: campoAtual,
                mensagem: 'Valor inválido no campo VALOR',
                valorRecebido,
                valorEsperado: undefined
              })
            }
          } else {
            valor = Number(line.VALOR.toFixed(2))
          }



          // === STATUS === //
          campoAtual = 'PAGO'
          
          const mapStatus: Record<string, string> = {
            'OK': 'PAGO',
            'PAGO': 'PAGO',
            'PENDENTE': 'PENDENTE'
          }

          let status = ''
          if (!line['PAGO'] || !(line['PAGO'] in mapStatus)) {
            valorRecebido = line['PAGO'] ? line['PAGO'] : ''

            erros.push({
              linha: linhaAtual,
              campo: campoAtual,
              mensagem: 'Valor inválido no campo PAGO',
              valorRecebido,
              valorEsperado: undefined
            })
          } else {
            status = mapStatus[line['PAGO']]
          }


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
            smart_key: createSmartKey(baseObject),
            recibo_parcela,
          }

          if (seenIds.has(registroFinal.id)) {
            duplicateIdsArray.push(registroFinal.id)
          } else {
            seenIds.add(registroFinal.id)
            uniqueExcel.push(registroFinal as PlanilhaHoEckermannResponse)
          }
        })

        if (erros.length > 0) {
          return reply.status(422).send({
            statusCode: 422,
            message: 'Foram encontrados erros na validação do arquivo.',
            error: 'Unprocessable Entity',
            erros,
          })
        }

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

        return reply.internalServerError(error.message)
      } finally {
        if (filePath && existsSync(filePath)) {
          unlinkSync(filePath)
        }
      }
    },
  )
}
