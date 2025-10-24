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

      function toSQLValue(val: any): string {
        if (val === null || val === undefined) return 'NULL'
        if (typeof val === 'string') {
          // Trata strings vazias como NULL, exceto quando o campo é o ID
          if (val === '') return 'NULL'
          return `'${val.replace(/'/g, "''")}'`
        }
        if (val instanceof Date) return `'${val.toISOString()}'`
        return val.toString()
      }

      // Estrutura para coletar as atualizações
      const updatesToApply: {
        id: string
        status: string
        banco: string
        valor_validado: number | null
        data_pagamento: string | null
        original_registro_id: string
      }[] = []

      // ----------------------------------------------------------------------
      // PASSO 1: Identificar Atualizações (SELECT em paralelo)
      // ----------------------------------------------------------------------

      // Otimização: Filtra apenas os registros que vêm com status 'PAGO'
      const registrosComStatusPago = registros.filter(
        (r) => r.status === 'PAGO',
      )

      try {
        await Promise.all(
          registrosComStatusPago.map(
            async (registro) => {
              const {
                cliente,
                carteira,
                descricao_honorario,
                data_vencimento,
                valor,
                recibo_parcela,
                fonte_pagadora,
                empresa,
                status: statusLancado,
              } = registro

              // Adiciona aspas em todos os campos string, exceto valor
              const clienteSQL = toSQLValue(cliente)
              const carteiraSQL = toSQLValue(carteira)
              const descricaoHonorarioSQL = toSQLValue(descricao_honorario)
              const dataVencimentoSQL = toSQLValue(data_vencimento)
              const reciboParcelaSQL = toSQLValue(recibo_parcela)
              const fontePagadoraSQL = toSQLValue(fonte_pagadora)
              const empresaSQL = toSQLValue(empresa)

              const { recordset } = await db.query<{
                id: string
                status: string
              }>(`
                SELECT id, status
                FROM eckermann_contas_a_receber
                WHERE cliente = ${clienteSQL}
                  AND carteira = ${carteiraSQL}
                  AND descricao_honorario = ${descricaoHonorarioSQL}
                  AND data_vencimento = ${dataVencimentoSQL}
                  AND valor = ${valor}
                  AND recibo_parcela = ${reciboParcelaSQL}
                  AND fonte_pagadora = ${fontePagadoraSQL}
                  AND empresa = ${empresaSQL}
              `)

              recordset.forEach(({ id: dbId, status: dbStatus }) => {
                if (dbStatus === 'PENDENTE' && statusLancado === 'PAGO') {
                  updatesToApply.push({
                    id: dbId,
                    status: registro.status,
                    banco: registro.banco,
                    valor_validado: registro.valor_validado ?? null,
                    data_pagamento: registro.data_pagamento ?? null,
                    original_registro_id: registro.id,
                  })
                }
              })
            },
          ),
        )
      } catch (error: any) {
        console.error('Erro na fase de SELECT de atualização:', error.message)
      }

      const idsAtualizadosPeloLote = updatesToApply.map(
        (u) => u.original_registro_id,
      )
      const registrosParaInserir = registros.filter(
        (item) => !idsAtualizadosPeloLote.includes(item.id),
      )

      // ----------------------------------------------------------------------
      // PASSO 2: Transação para UPDATE em Lote e INSERT/MERGE
      // ----------------------------------------------------------------------

      let transaction: sql.Transaction | undefined = undefined
      let registrosAtualizados = 0
      let registrosInseridos = 0
      let registrosDuplicados = 0

      try {
        transaction = new sql.Transaction(db)
        await transaction.begin()
        const requestTx = new sql.Request(transaction)

        // 2a. Executa o UPDATE em Lote dos status encontrados
        if (updatesToApply.length > 0) {
          // Cria uma tabela temporária para as atualizações
          const updateTempTableColumns = `
            id NVARCHAR(255), 
            novo_status NVARCHAR(255), 
            novo_banco NVARCHAR(255), 
            novo_valor_validado DECIMAL(18, 2), 
            nova_data_pagamento DATETIMEOFFSET
          `
          const updateValuesList = updatesToApply
            .map((u) => {
              const statusSQL = toSQLValue(u.status)
              const bancoSQL = toSQLValue(u.banco)
              const valorValidadoSQL = toSQLValue(u.valor_validado)
              const dataPagamentoSQL = toSQLValue(u.data_pagamento)

              return `('${u.id}', ${statusSQL}, ${bancoSQL}, ${valorValidadoSQL}, ${dataPagamentoSQL})`
            })
            .join(',\n')

          const updateBatchSQL = `
            IF OBJECT_ID('tempdb..#TempUpdates') IS NOT NULL DROP TABLE #TempUpdates;
            CREATE TABLE #TempUpdates (${updateTempTableColumns});

            INSERT INTO #TempUpdates (id, novo_status, novo_banco, novo_valor_validado, nova_data_pagamento)
            VALUES 
            ${updateValuesList};

            UPDATE T
            SET 
              T.status = S.novo_status,
              T.banco = S.novo_banco,
              T.valor_validado = S.novo_valor_validado,
              T.data_pagamento = S.nova_data_pagamento
            FROM dbo.eckermann_contas_a_receber T
            INNER JOIN #TempUpdates S ON T.id = S.id;
          `
          const updateResult = await requestTx.query(updateBatchSQL)
          registrosAtualizados = updateResult.rowsAffected
            ? Number(updateResult.rowsAffected)
            : updatesToApply.length
        }

        // 2b. Executa o INSERT/MERGE para os registros restantes
        if (registrosParaInserir.length > 0) {
          const comandos: string[] = registrosParaInserir.map((item) => {
            // Garante que todos os campos estão na ordem correta, mesmo que ausentes
            const values = TODOS_CAMPOS.map((campo) =>
              toSQLValue((item as any)[campo]),
            )

            const sourceSelect = TODOS_CAMPOS.map(
              (campo, i) => `${values[i]} AS ${campo}`,
            ).join(', ')

            const insertColumns = TODOS_CAMPOS.join(', ')
            const insertValues = TODOS_CAMPOS.map(
              (campo) => `source.${campo}`,
            ).join(', ')

            // MERGE individual para cada registro restante (lento, mas evita duplicidade)
            return `MERGE INTO dbo.eckermann_contas_a_receber AS target
              USING (SELECT ${sourceSelect}) AS source
              ON target.id = source.id
              WHEN NOT MATCHED THEN
                INSERT (${insertColumns}) VALUES (${insertValues})
              WHEN MATCHED THEN
                UPDATE SET target.id = target.id; -- Simplesmente não faz nada (considerado duplicado)
            `
          })

          const batchSQL = comandos.join('\n')
          const response = await requestTx.batch(batchSQL)

          if (Array.isArray(response.rowsAffected)) {
            registrosInseridos = response.rowsAffected.reduce(
              (acc, v) => acc + v,
              0,
            )
          }

          registrosDuplicados = registrosParaInserir.length - registrosInseridos
        }
        
        await transaction.commit()

        return reply.send({
          registrosDuplicados,
          registrosInseridos,
          registrosAtualizados,
        })
      } catch (error: any) {
        return reply.notAcceptable(
          `Erro na transação de dados: ${error.message}`,
        )
      }
    },
  )
}
