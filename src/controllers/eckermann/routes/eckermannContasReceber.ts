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
  valor_validado: z.number().nullable().optional(),
})

type Registro = z.infer<typeof registroSchema>
const TODOS_CAMPOS = Object.keys(registroSchema.shape) as (keyof Registro)[]

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
            registrosAtualizados: z.number(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { registros } = request.body
      const db = await getEckermannConnection()

      console.log(`[INFO] Total de registros recebidos: ${registros.length}`)

      const uniqueIds = new Set(registros.map((r) => r.id))
      const inputDuplicatesCount = registros.length - uniqueIds.size
      console.log(`[INFO] IDs únicos no payload: ${uniqueIds.size}`)
      console.log(`[INFO] IDs duplicados no payload: ${inputDuplicatesCount}`)

      function toSQLValue(val: any): string {
        if (val === null || val === undefined) return 'NULL'
        if (typeof val === 'string') {
          if (val === '') return 'NULL'
          return `'${val.replace(/'/g, "''")}'`
        }
        if (val instanceof Date) return `'${val.toISOString()}'`
        return val.toString()
      }

      let transaction: sql.Transaction | undefined
      let registrosInseridos = 0
      let registrosDuplicados = 0
      let registrosAtualizados = 0

      try {
        transaction = new sql.Transaction(db)
        await transaction.begin()
        const requestTx = new sql.Request(transaction)

        if (registros.length > 0) {
          // 1. Cria a tabela temporária com todos os campos
          const insertTempTableColumns = TODOS_CAMPOS.map((campo) => {
            let sqlDataType: string
            switch (campo) {
              case 'id':
                sqlDataType = 'NVARCHAR(400)'
                break
              case 'cliente':
              case 'carteira':
              case 'descricao_honorario':
              case 'codigo_identificacao':
              case 'recibo_parcela':
              case 'status':
              case 'fonte_pagadora':
              case 'banco':
              case 'socio':
              case 'empresa':
                sqlDataType = 'NVARCHAR(500)'
                break
              case 'data_vencimento':
              case 'data_pagamento':
                sqlDataType = 'DATETIME'
                break
              case 'valor':
              case 'valor_validado':
                sqlDataType = 'DECIMAL(18, 2)'
                break
              default:
                sqlDataType = 'NVARCHAR(MAX)'
            }
            return `${campo} ${sqlDataType}`
          }).join(',\n')

          // 2. Gera os valores da tabela temporária
          const insertValuesList = registros
            .map((item) => {
              const values = TODOS_CAMPOS.map((campo) =>
                toSQLValue((item as any)[campo]),
              )
              return `(${values.join(', ')})`
            })
            .join(',\n')

          const insertColumns = TODOS_CAMPOS.join(', ')

          // 3. MERGE com lógica de atualização e contagem via OUTPUT
          const mergeBatchSQL = `
            IF OBJECT_ID('tempdb..#TempInserts') IS NOT NULL DROP TABLE #TempInserts;
            CREATE TABLE #TempInserts (${insertTempTableColumns});

            INSERT INTO #TempInserts (${insertColumns})
            VALUES 
            ${insertValuesList};

            DECLARE @Results TABLE (
              ActionType NVARCHAR(20),
              SourceId NVARCHAR(400)
            );

            MERGE INTO dbo.eckermann_contas_a_receber AS target
            USING #TempInserts AS source
            ON target.id = source.id

            WHEN MATCHED THEN
              UPDATE SET
                target.status = source.status,
                target.banco = source.banco,
                target.data_pagamento = source.data_pagamento,
                target.valor_validado = source.valor_validado

            WHEN NOT MATCHED BY TARGET THEN
              INSERT (${insertColumns})
              VALUES (${TODOS_CAMPOS.map((c) => `source.${c}`).join(', ')})

            OUTPUT
              CASE 
                WHEN $action = 'INSERT' THEN 'INSERT'
                WHEN $action = 'UPDATE' AND (
                  ISNULL(deleted.status, '') <> ISNULL(inserted.status, '') OR
                  ISNULL(deleted.banco, '') <> ISNULL(inserted.banco, '') OR
                  ISNULL(CONVERT(VARCHAR(25), deleted.data_pagamento, 126), '') <> ISNULL(CONVERT(VARCHAR(25), inserted.data_pagamento, 126), '') OR
                  ISNULL(deleted.valor_validado, 0) <> ISNULL(inserted.valor_validado, 0)
                ) THEN 'UPDATED_REAL'
                WHEN $action = 'UPDATE' THEN 'DUPLICATE'
                ELSE $action
              END AS ActionType,
              inserted.id AS SourceId
            INTO @Results;

            SELECT ActionType, COUNT(*) AS Count FROM @Results GROUP BY ActionType;
          `


          const mergeResult = await requestTx.query<{
            ActionType: 'INSERT' | 'UPDATED_REAL' | 'DUPLICATE' | 'UPDATE' | 'DELETE'
            Count: number
          }>(mergeBatchSQL)

          // 4. Processa o resultado
          mergeResult.recordset.forEach((row) => {
            if (row.ActionType === 'INSERT') registrosInseridos += row.Count
            else if (row.ActionType === 'UPDATED_REAL') registrosAtualizados += row.Count
            else if (row.ActionType === 'DUPLICATE') registrosDuplicados += row.Count
          })

          console.log(`[INFO] MERGE Result:`, mergeResult.recordset)
        }

        await transaction.commit()

        return reply.send({
          registrosDuplicados: Number(registrosDuplicados || 0),
          registrosInseridos: Number(registrosInseridos || 0),
          registrosAtualizados: Number(registrosAtualizados || 0),
        })
      } catch (error: any) {
        if (transaction) {
          await transaction.rollback()
        }
        console.error('Erro na transação:', error)
        return reply.internalServerError(`Erro na transação: ${error.message}`)
      }
    },
  )
}
