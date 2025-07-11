import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { getMSSQLConnection } from '@/database/mssql'
import sql from 'mssql'
import { extratoSchema } from '@/schemas/eckermann/extratoSchema'

export function eckermannExtratos(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/extratos',
    {
      schema: {
        body: z.object({
          registros: z.array(extratoSchema),
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
      const db = await getMSSQLConnection()

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

        return `MERGE INTO eckermann_extratos AS target
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
          registrosInseridos = response.rowsAffected.reduce((acc, v) => acc + v, 0)
        }

        registrosDuplicados -= registrosInseridos

        await transaction.commit()

        return reply.send({ registrosDuplicados, registrosInseridos })
      } catch (error: any) {
        return reply.notAcceptable(`Erro ao executar comandos MERGE em batch: ${error.message}`)
      }
    },
  )
}
