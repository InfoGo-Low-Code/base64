import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { getEckermannConnection } from '@/database/eckermann'
import sql from 'mssql'

// O schema permanece o mesmo, definindo a estrutura de um registro
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

// O schema da resposta foi mantido
const responseSchema = z.object({
  registrosInseridos: z.number(),
  registrosDuplicados: z.number(),
  registrosAtualizados: z.number(),
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
          200: responseSchema,
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { registros } = request.body
      const db = await getEckermannConnection()

      // Função utilitária para formatar valores para SQL, mitigando SQL Injection
      // (Recomendado usar request.input() para produção, mas mantido aqui para consistência)
      function toSQLValue(val: any): string {
        if (val === null || val === undefined) return 'NULL'
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
        if (val instanceof Date) return `'${val.toISOString()}'`
        return val.toString()
      }

      // ----------------------------------------------------------------------
      // PASSO 1: Criar a Tabela Temporária para Coletar Resultados do MERGE
      // ----------------------------------------------------------------------
      // Deve ser a primeira coisa na transação
      let batchSQL = `
        IF OBJECT_ID('tempdb..#MergeOutput') IS NOT NULL DROP TABLE #MergeOutput;
        CREATE TABLE #MergeOutput (ActionType NVARCHAR(10), Id NVARCHAR(50));
      `
      
      // ----------------------------------------------------------------------
      // PASSO 2: Gerar Comandos MERGE para TODOS os registros
      // ----------------------------------------------------------------------

      registros.forEach((item) => {
        const campos = Object.keys(item)
        const values = campos.map((campo) => toSQLValue((item as any)[campo]))

        const sourceSelect = campos
          .map((campo, i) => `${values[i]} AS ${campo}`)
          .join(', ')

        const insertColumns = campos.join(', ')
        const insertValues = campos.map((campo) => `source.${campo}`).join(', ')

        // Campos que definem a unicidade de um registro (chave de negócio)
        const mergeOnCondition = `
            target.cliente = source.cliente 
            AND target.carteira = source.carteira 
            AND target.descricao_honorario = source.descricao_honorario
            AND target.data_vencimento = source.data_vencimento
            AND target.valor = source.valor
            AND target.recibo_parcela = source.recibo_parcela
            AND target.fonte_pagadora = source.fonte_pagadora
            AND target.empresa = source.empresa
        `
        
        // Concatena o MERGE, usando OUTPUT para armazenar o resultado na tabela temporária
        batchSQL += `
          MERGE INTO dbo.eckermann_contas_a_receber AS target
          USING (SELECT ${sourceSelect}) AS source
          ON ${mergeOnCondition} 
          
          -- Apenas atualiza se existir (MATCHED) E o status no DB for PENDENTE E no Source for PAGO
          WHEN MATCHED AND target.status = 'PENDENTE' AND source.status = 'PAGO' THEN
            UPDATE SET 
              target.status = source.status, 
              target.data_pagamento = source.data_pagamento,
              target.valor_validado = source.valor_validado -- Inclua outros campos que podem ser atualizados
              
          -- Caso não seja encontrado, insere o registro
          WHEN NOT MATCHED THEN
            INSERT (${insertColumns}) VALUES (${insertValues})
          
          -- Captura o resultado da ação (INSERT ou UPDATE)
          OUTPUT $action, source.id INTO #MergeOutput (ActionType, Id);
        `
      })

      // ----------------------------------------------------------------------
      // PASSO 3: Executar Transação e Contar Resultados
      // ----------------------------------------------------------------------

      try {
        const transaction = new sql.Transaction(db)
        await transaction.begin()

        const requestTx = new sql.Request(transaction)

        // 1. Executa todos os comandos MERGE (que também preenchem #MergeOutput)
        await requestTx.batch(batchSQL)

        // 2. Seleciona o resumo dos resultados da tabela temporária
        const { recordset: summary } = await requestTx.query<{
          ActionType: 'INSERT' | 'UPDATE' | 'DELETE'
          Total: number
        }>(`
          SELECT ActionType, COUNT(*) as Total
          FROM #MergeOutput
          GROUP BY ActionType;
        `)

        await transaction.commit()
        
        // 3. Processa o relatório
        let registrosInseridos = 0
        let registrosAtualizados = 0
        
        summary.forEach((row) => {
          if (row.ActionType === 'INSERT') {
            registrosInseridos = row.Total
          } else if (row.ActionType === 'UPDATE') {
            registrosAtualizados = row.Total
          }
        })
        
        // Registros duplicados (não afetados) = total de registros - (inseridos + atualizados)
        const registrosDuplicados =
          registros.length - (registrosInseridos + registrosAtualizados)


        return reply.send({
          registrosDuplicados,
          registrosInseridos,
          registrosAtualizados,
        })
      } catch (error: any) {
        return reply.notAcceptable(
          `Erro ao executar comandos MERGE em batch: ${error.message}`,
        )
      }
    },
  )
}
