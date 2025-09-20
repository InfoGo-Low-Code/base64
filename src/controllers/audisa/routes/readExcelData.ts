import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { getDwAudisaConnection } from '@/database/dwAudisa'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { readFile, utils } from 'xlsx'
import { z } from 'zod'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { excelDateToJSDate } from '@/utils/parseXlsxDate'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { ConnectionPool, Request } from 'mssql'

const excelDataSchema = z.object({
  A: z.string(),
  B: z.string(),
  C: z.string(),
  D: z.string(),
  E: z.string(),
  F: z.string(),
  G: z.string(),
  H: z.string(),
})

type ExcelDataSchema = z.infer<typeof excelDataSchema>

const roundToTwo = (value: number) => Math.round(value * 100) / 100

const excelDataTransformed = z.object({
  contaAtual: z.string(),
  data: z.string(),
  lote: z.string(),
  lanc: z.string(),
  cPartida: z.string(),
  historico: z.string(),
  debito: z.number().transform(roundToTwo),
  credito: z.number().transform(roundToTwo),
  saldo: z.number().transform(roundToTwo),
})

type ExcelDataTransformed = z.infer<typeof excelDataTransformed>

function toSQLInsert(array: ExcelDataTransformed[], empresa: string): string[] {
  const sqlInserts = array.map((item, idx) => {
    const valor = item.debito === 0 ? item.credito : item.debito
    const ID = idx + 1

    return `INSERT INTO razao_${empresa} (conta, conta_partida, data, numero, historico, cta_c_part, debito, credito, saldo, ID, valor)
      VALUES ('${item.contaAtual}', '${item.cPartida}', '${item.data}', '${item.lote}', '${item.historico}', '${item.lanc}', ${item.debito}, ${item.credito}, ${item.saldo}, '${ID}', ${valor})`
  })

  return sqlInserts
}

async function runBatchInChunks(
  comandos: string[],
  db: ConnectionPool,
  chunkSize = 1000,
): Promise<{
  inserted_data: number
}> {
  let inserted_data = 0
  const chunks = Array.from(
    { length: Math.ceil(comandos.length / chunkSize) },
    (_, i) => comandos.slice(i * chunkSize, (i + 1) * chunkSize),
  )

  const request = new Request(db)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    try {
      const response = await request.batch(chunk.join('\n'))
      if (Array.isArray(response.rowsAffected)) {
        inserted_data += response.rowsAffected.reduce((acc, v) => acc + v, 0)
      }
    } catch (err) {
      console.error(`Erro ao inserir chunk ${i}:`, err)
      throw err
    }
  }

  return { inserted_data }
}

export function readExcelData(app: FastifyZodTypedInstance) {
  app.post(
    '/audisa/readExcelData',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
          empresa: z.string().transform((value) => value.toLowerCase().replace(' ', '_')),
        }),
        response: {
          201: z.object({
            message: z.literal('Registros inseridos com sucesso'),
            registrosInseridos: z.number(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { url, empresa } = request.body

      if (!existsSync('./uploads')) {
        mkdirSync('./uploads', { recursive: true })
      }

      let filePath = ''

      try {
        const { data } = await app.axios.get(url, {
          responseType: 'arraybuffer',
        })

        const filename = basename(new URL(url).pathname)
        filePath = `./uploads/${filename}`

        writeFileSync(filePath, data)
      } catch {
        return reply.internalServerError('Erro ao baixar arquivo')
      }

      const workbook = readFile(filePath)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const dataXlsx: ExcelDataSchema[] = utils.sheet_to_json(worksheet, {
        header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        blankrows: true,
      })

      let currentIdxDebito = -1
      let currentIdxCredito = -1
      let currentIdxSaldo = -1
      let currentIdxData = -1
      let currentIdxLote = -1
      let currentIdxLanc = -1
      let currentIdxCPartida = -1
      let currentIdxHistorico = -1
      const regexAccount = new RegExp(/^\d\.\d\.\d\.\d{2}\.\d{5}$/)

      let contaAtual = ''

      const registers: ExcelDataTransformed[] = []

      dataXlsx.forEach((register, idx) => {
        const accountValidation = regexAccount.test(register.A)

        if (accountValidation) {
          contaAtual = register.A
        }

        const normalizedRows = Object.values(register).map((value) => {
          return normalize(value)
        })

        if (
          normalizedRows.includes('DEBITO') &&
          normalizedRows.includes('CREDITO') &&
          normalizedRows.includes('SALDO')
        ) {
          currentIdxData = normalizedRows.findIndex((c) => c === 'DATA')
          currentIdxLote = normalizedRows.findIndex((c) => c === 'LOTE')
          currentIdxLanc = normalizedRows.findIndex((c) => c === 'LANC')
          currentIdxCPartida = normalizedRows.findIndex(
            (c) => c === 'C/PARTIDA',
          )
          currentIdxHistorico = normalizedRows.findIndex(
            (c) => c === 'HISTORICO',
          )
          currentIdxDebito = normalizedRows.findIndex((c) => c === 'DEBITO')
          currentIdxCredito = normalizedRows.findIndex((c) => c === 'CREDITO')
          currentIdxSaldo = normalizedRows.findIndex((c) => c === 'SALDO')
        } else {
          const values = Object.values(register)

          if (values.length > 3) {
            const data = values[currentIdxData]
            const lote = values[currentIdxLote]
            const lanc = values[currentIdxLanc]
            const cPartida = values[currentIdxCPartida]
            const historico = values[currentIdxHistorico]
            const debito = values[currentIdxDebito]
            const credito = values[currentIdxCredito]
            const saldo = values[currentIdxSaldo]

            if (
              !data ||
              !lote ||
              !lanc ||
              !cPartida ||
              !historico ||
              debito === undefined ||
              debito === null ||
              credito === undefined ||
              credito === null ||
              saldo === undefined ||
              saldo === null
            ) {
              // Lógica caso falte algum campo
            } else {
              let dataTransformed: string | null = ''
              let contaPartida: string | null = ''

              if (data.includes('/')) {
                const valoresData = data.split('/')

                if (valoresData.length !== 3) {
                  dataTransformed = null
                } else {
                  const [diaJs, mesJs, anoJs] = valoresData

                  dataTransformed = `${anoJs}-${mesJs}-${diaJs}`
                }
              } else if (data.includes('-')) {
                const valoresData = data.split('-')

                if (valoresData.length !== 3) {
                  dataTransformed = null
                } else {
                  const [diaJs, mesJs, anoJs] = valoresData

                  dataTransformed = `${anoJs}-${mesJs}-${diaJs}`
                }
              } else if (typeof data === 'number') {
                const [diaJs, mesJs, anoJs] = excelDateToJSDate(data)
                  .toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                  .split('-')

                dataTransformed = `${anoJs}-${mesJs}-${diaJs}`
              } else {
                dataTransformed = null
              }

              if (
                !regexAccount.test(cPartida) &&
                normalize(cPartida) !== 'MULTIPLO'
              ) {
                contaPartida = null
              } else {
                contaPartida = cPartida
              }

              if (dataTransformed !== null && contaPartida !== null) {
                const parsedRegister = excelDataTransformed.parse({
                  contaAtual: String(contaAtual),
                  data: dataTransformed,
                  lote: String(lote),
                  lanc: String(lanc),
                  cPartida: String(contaPartida),
                  historico: String(historico),
                  debito: Number(debito),
                  credito: Number(credito),
                  saldo: Number(saldo),
                })

                registers.push(parsedRegister)
              }
            }
          }
        }
      })

      const db = await getDwAudisaConnection()

      const { recordset: existingTables } = await db.query(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME LIKE 'razao_${empresa}'
        ORDER BY TABLE_NAME DESC
      `)

      if (existingTables.length > 0) {
        const comandos = toSQLInsert(registers, empresa)

        const { inserted_data: registrosInseridos } = await runBatchInChunks(
          comandos,
          db,
        )

        return reply.status(201).send({
          message: 'Registros inseridos com sucesso',
          registrosInseridos,
        })
      }

      try {
        await db.query(`
          CREATE TABLE razao_${empresa} (
            conta NVARCHAR(255),
            conta_partida NVARCHAR(255),
            data DATETIME,
            numero NVARCHAR(255),
            historico NVARCHAR(255),
            cta_c_part NVARCHAR(255),
            debito NUMERIC(10, 2),
            credito NUMERIC(10, 2),
            saldo NUMERIC(10, 2),
            saldo_exercicio NUMERIC(10, 2),
            ID INT NOT NULL,
            valor NUMERIC(10, 2),
            Prob float,
            valicacao varchar(50)
          )
        `)
      } catch (e: any) {
        unlinkSync(filePath)

        return reply.internalServerError(e.message)
      }

      const comandos = toSQLInsert(registers, empresa)

      const { inserted_data: registrosInseridos } = await runBatchInChunks(
        comandos,
        db,
      )

      unlinkSync(filePath)

      return reply.status(201).send({
        message: 'Registros inseridos com sucesso',
        registrosInseridos,
      })
    },
  )
}

function normalize(str: string) {
  return String(str)
    .normalize('NFD') // separa acentos
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase()
    .trim()
}
