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

      // ============================
      // TVP (Table-Valued Parameter)
      // ============================
      const table = new sql.Table('EckermannContasReceberType')

      table.columns.add('id', sql.NVarChar(400))
      table.columns.add('cliente', sql.NVarChar(500))
      table.columns.add('carteira', sql.NVarChar(500))
      table.columns.add('descricao_honorario', sql.NVarChar(500))
      table.columns.add('data_vencimento', sql.DateTime)
      table.columns.add('codigo_identificacao', sql.NVarChar(500))
      table.columns.add('valor', sql.Decimal(18, 2))
      table.columns.add('recibo_parcela', sql.NVarChar(500))
      table.columns.add('status', sql.NVarChar(500))
      table.columns.add('fonte_pagadora', sql.NVarChar(500))
      table.columns.add('banco', sql.NVarChar(500))
      table.columns.add('data_pagamento', sql.DateTime)
      table.columns.add('socio', sql.NVarChar(500))
      table.columns.add('empresa', sql.NVarChar(500))
      table.columns.add('valor_validado', sql.Decimal(18, 2))

      // ============================
      // Preenchimento da TVP
      // ============================
      for (const r of registros) {
        table.rows.add(
          r.id,
          r.cliente,
          r.carteira,
          r.descricao_honorario,
          r.data_vencimento ? new Date(r.data_vencimento) : null,
          r.codigo_identificacao,
          r.valor,
          r.recibo_parcela,
          r.status,
          r.fonte_pagadora,
          r.banco,
          r.data_pagamento ? new Date(r.data_pagamento) : null,
          r.socio,
          r.empresa,
          r.valor_validado ?? 0
        )
      }

      console.log('[INFO] TVP preenchida com sucesso')

      try {
        const result = await db
          .request()
          .input('Registros', table)
          .execute('spMergeEckermannContasReceber')

        console.log('[INFO] Resultado do MERGE:', result.recordset)

        const stats = {
          registrosInseridos: result.recordset.find((r: any) => r.ActionType === 'INSERT')?.Count || 0,
          registrosAtualizados: result.recordset.find((r: any) => r.ActionType === 'UPDATED_REAL')?.Count || 0,
          registrosDuplicados: result.recordset.find((r: any) => r.ActionType === 'DUPLICATE')?.Count || 0,
        }

        return reply.send(stats)
      } catch (error: any) {
        console.error('Erro no MERGE:', error)
        return reply.internalServerError(`Erro na transação: ${error.message}`)
      }
    }
  )
}
