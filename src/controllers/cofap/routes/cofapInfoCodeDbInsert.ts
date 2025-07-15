import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'

import { racionalizadosResponseSchema } from '@/utils/cofap/parserRacionalizados'
import { produtoResponseSchema } from '@/utils/cofap/parserProdutos'
import { produtoSimilarResponseSchema } from '@/utils/cofap/parserCodigoSimilar'
import { crossReferencesSchema } from '@/schemas/cofap/infocode/crossReferencesSchema'
import { getCofapConnection } from '@/database/cofap'
import { readFileSync, unlinkSync } from 'node:fs'
import { ConnectionPool, Request } from 'mssql'
import { differenceInMilliseconds } from 'date-fns'

const jsonData = z.object({
  racionalizados: z.array(racionalizadosResponseSchema),
  comunizados: z.array(produtoSimilarResponseSchema),
  troca_codigo: z.array(produtoSimilarResponseSchema),
  versoes: z.array(produtoSimilarResponseSchema),
  cross_references: z.array(crossReferencesSchema),
  produtos: z.array(produtoResponseSchema),
})

const arrayInsertSchema = z.array(
  z.union([
    racionalizadosResponseSchema,
    produtoSimilarResponseSchema,
    crossReferencesSchema,
    produtoResponseSchema,
  ]),
)

type ArrayInsertSchema = z.infer<typeof arrayInsertSchema>

function toSQLInsert(array: ArrayInsertSchema, table: string): string[] {
  const sqlInserts = array.map((item) => {
    const campos = Object.keys(item)
    const values = Object.values(item)

    const insertColumns = campos.join(', ')
    const insertValues = values.map((value) => `'${value}'`).join(', ')

    return `INSERT INTO ${table} (${insertColumns}) VALUES (${insertValues})`
  })

  return sqlInserts
}

async function runBatchInChunks(
  comandos: string[],
  table: string,
  db: ConnectionPool,
  chunkSize = 1000,
): Promise<{ inserted_data: number, execution_time_ms: number }> {
  const startTime = new Date()
  let inserted_data = 0
  const chunks = Array.from(
    { length: Math.ceil(comandos.length / chunkSize) },
    (_, i) => comandos.slice(i * chunkSize, (i + 1) * chunkSize),
  )

  const request = new Request(db)
  await request.batch(`TRUNCATE TABLE ${table}`)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    try {
      const response = await request.batch(chunk.join('\n'))
      if (Array.isArray(response.rowsAffected)) {
        inserted_data += response.rowsAffected.reduce(
          (acc, v) => acc + v,
          0,
        )
      }
    } catch (err) {
      console.error(`Erro ao inserir chunk ${i}:`, err)
      throw err
    }
  }

  const execution_time_ms = differenceInMilliseconds(new Date(), startTime)

  return { inserted_data, execution_time_ms }
}

export function cofapInfoCodeDbInsert(app: FastifyZodTypedInstance) {
  app.post(
    '/cofap/infoCodeDbInsert',
    {
      schema: {
        body: z.object({
          uuid: z.string().uuid(),
          racionalizados_time_in_ms: z.number(),
          comunizados_time_in_ms: z.number(),
          troca_codigo_time_in_ms: z.number(),
          versoes_time_in_ms: z.number(),
          cross_references_time_in_ms: z.number(),
          produtos_time_in_ms: z.number(),
        }),
        response: {
          200: z.object({
            inserted_racionalizados: z.number(),
            racionalizados_time_in_ms: z.number(),
            inserted_comunizados: z.number(),
            comunizados_time_in_ms: z.number(),
            inserted_troca_codigo: z.number(),
            troca_codigo_time_in_ms: z.number(),
            inserted_versoes: z.number(),
            versoes_time_in_ms: z.number(),
            inserted_cross_references: z.number(),
            cross_references_time_in_ms: z.number(),
            inserted_produtos: z.number(),
            produtos_time_in_ms: z.number(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { uuid, racionalizados_time_in_ms, comunizados_time_in_ms, troca_codigo_time_in_ms, versoes_time_in_ms, cross_references_time_in_ms, produtos_time_in_ms } = request.body
      const db = await getCofapConnection()

      const filePath = `./uploads/${uuid}.json`

      const fileContent = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(fileContent)

      const {
        racionalizados,
        comunizados,
        troca_codigo,
        versoes,
        cross_references,
        produtos,
      } = jsonData.parse(data)

      const comandosRacionalizados: string[] = toSQLInsert(
        racionalizados,
        'RACIONALIZADOS_TESTE',
      )
      const comandosComunizados: string[] = toSQLInsert(
        comunizados,
        'COMUNIZADOS_COMUNIZOU_TESTE',
      )
      const comandosTrocaCodigo: string[] = toSQLInsert(
        troca_codigo,
        'TROCA_CODIGO_TESTE',
      )
      const comandosVersoes: string[] = toSQLInsert(versoes, 'VERSOES_TESTE')
      const comandosCrossReferences: string[] = toSQLInsert(
        cross_references,
        'CROSS_REFERENCES_TESTE',
      )
      const comandosProdutos: string[] = toSQLInsert(produtos, 'PRODUTOS_TESTE')

      try {
        const { execution_time_ms: racionalizadosTime, inserted_data: inserted_racionalizados } = await runBatchInChunks(
          comandosRacionalizados,
          'RACIONALIZADOS_TESTE',
          db,
        )
        const {execution_time_ms: comunizadosTime,inserted_data: inserted_comunizados} = await runBatchInChunks(
          comandosComunizados,
          'COMUNIZADOS_COMUNIZOU_TESTE',
          db,
        )
        const {execution_time_ms: trocaCodigoTime,inserted_data: inserted_troca_codigo} = await runBatchInChunks(
          comandosTrocaCodigo,
          'TROCA_CODIGO_TESTE',
          db,
        )
        const {execution_time_ms: versoesTime,inserted_data: inserted_versoes} = await runBatchInChunks(
          comandosVersoes,
          'VERSOES_TESTE',
          db,
        )
        const {execution_time_ms: crossReferencesTime,inserted_data: inserted_cross_references} = await runBatchInChunks(
          comandosCrossReferences,
          'CROSS_REFERENCES_TESTE',
          db,
        )
        const {execution_time_ms: produtosTime,inserted_data: inserted_produtos} = await runBatchInChunks(
          comandosProdutos,
          'PRODUTOS_TESTE',
          db,
        )

        unlinkSync(filePath)

        const totalTimeRacionalizados = racionalizadosTime + racionalizados_time_in_ms
        const totalTimeComunizados = comunizadosTime + comunizados_time_in_ms
        const totalTimeTrocaCodigo = trocaCodigoTime + troca_codigo_time_in_ms
        const totalTimeVersoes = versoesTime + versoes_time_in_ms
        const totalTimeCrossReferences = crossReferencesTime + cross_references_time_in_ms
        const totalTimeProdutos = produtosTime + produtos_time_in_ms

        return reply.send({
          inserted_racionalizados,
          racionalizados_time_in_ms: totalTimeRacionalizados,
          inserted_comunizados,
          comunizados_time_in_ms: totalTimeComunizados,
          inserted_troca_codigo,
          troca_codigo_time_in_ms: totalTimeTrocaCodigo,
          inserted_versoes,
          versoes_time_in_ms: totalTimeVersoes,
          inserted_cross_references,
          cross_references_time_in_ms: totalTimeCrossReferences,
          inserted_produtos,
          produtos_time_in_ms: totalTimeProdutos,
        })
      } catch (error: any) {
        unlinkSync(filePath)

        return reply.notAcceptable(
          `Erro ao executar comandos INSERT em batch: ${error.message}`,
        )
      }
    },
  )
}
