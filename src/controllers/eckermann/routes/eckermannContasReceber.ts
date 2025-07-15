import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { getEckermannConnection } from '@/database/eckermann'
import sql from 'mssql'

const registroSchema = z.object({
  id: z.string(),
  cliente: z.string(),
  carteira: z.string(),
  descricao_honorario: z.string(),
  data_vencimento: z.string().nullable().optional(),
  codigo_identificacao: z.string(),
  valor: z.number(),
  recibo_parcela: z.string(),
  status: z.string(),
  fonte_pagadora: z.string(),
  banco: z.string(),
  data_pagamento: z.string().nullable().optional(),
  socio: z.string(),
  empresa: z.string(),
  valor_validado: z.number().nullable(),
})

export function eckermannContasReceber(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/contasReceber',
    {
      schema: {
        body: z.object({
          registros: z.array(registroSchema),
        }),
        response: {
          200: z.object({
            registrosInseridos: z.number(),
            registrosDuplicados: z.number(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { registros } = request.body
      const db = await getEckermannConnection()

      function toSQLValue(val: any): string {
        if (val === null || val === undefined) return 'NULL'
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
        if (val instanceof Date) return `'${val.toISOString()}'`
        return val.toString()
      }

      const comandos: string[] = registros.map((item) => {
        const campos = Object.keys(item)
        const values = campos.map((campo) => toSQLValue((item as any)[campo]))

        const sourceSelect = campos
          .map((campo, i) => `${values[i]} AS ${campo}`)
          .join(', ')

        const insertColumns = campos.join(', ')
        const insertValues = campos.map((campo) => `source.${campo}`).join(', ')

        return `MERGE INTO eckermann_contas_a_receber AS target
          USING (SELECT ${sourceSelect}) AS source
          ON target.id = source.id
          WHEN NOT MATCHED THEN
            INSERT (${insertColumns}) VALUES (${insertValues});`
      })

      try {
        let registrosInseridos = 0
        let registrosDuplicados = registros.length

        const transaction = new sql.Transaction(db)
        await transaction.begin()

        const requestTx = new sql.Request(transaction)

        // Junta tudo num único batch
        const batchSQL = comandos.join('\n')

        const response = await requestTx.batch(batchSQL)

        // response.rowsAffected é um array com os afetados por cada MERGE
        if (Array.isArray(response.rowsAffected)) {
          registrosInseridos = response.rowsAffected.reduce(
            (acc, v) => acc + v,
            0,
          )
        }

        registrosDuplicados -= registrosInseridos

        await transaction.commit()

        return reply.send({ registrosDuplicados, registrosInseridos })
      } catch (error: any) {
        return reply.notAcceptable(
          `Erro ao executar comandos MERGE em batch: ${error.message}`,
        )
      }
    },
  )
}
