import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { getDwAudisaConnection } from '@/database/dwAudisa'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { readFile, utils } from 'xlsx'
import { z } from 'zod'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { excelDateToJSDate } from '@/utils/parseXlsxDate'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { ConnectionPool, Request } from 'mssql'
import { setRouteUsageAudisa } from '@/utils/audisa/routeUsage'

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

function formatValue(value: any): string {
  if (
    value === null ||
    value === undefined ||
    value === 'null' ||
    value === 'undefined'
  ) {
    return 'NULL'
  }
  if (typeof value === 'number') {
    return value.toString()
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

function toSQLInsert(array: ExcelDataTransformed[], empresa: string): string[] {
  const sqlInserts = array.map((item, idx) => {
    const valor = item.debito === 0 ? item.credito : item.debito
    const ID = idx + 1

    return `INSERT INTO razao_${empresa} 
      (conta, conta_partida, data, numero, historico, cta_c_part, debito, credito, saldo, ID, valor)
      VALUES (
        ${formatValue(item.contaAtual)},
        ${formatValue(item.cPartida)},
        ${formatValue(item.data)},
        ${formatValue(item.lote)},
        ${formatValue(item.historico)},
        ${formatValue(item.lanc)},
        ${formatValue(item.debito)},
        ${formatValue(item.credito)},
        ${formatValue(item.saldo)},
        ${formatValue(ID)},
        ${formatValue(valor)}
      )`
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
          empresa: z.string().transform((value) =>
            value
              .toLowerCase()
              .replace(/ /g, '_')
              .replace(/[^\w_]/g, ''),
          ),
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
      setRouteUsageAudisa(true)

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

        const extension = extname(filename).slice(1)

        const allowedExtensions = ['xls', 'xlsx']

        if (!allowedExtensions.includes(extension)) {
          throw new Error('Extensão de arquivo inválida')
        }

        writeFileSync(filePath, data)
      } catch (e: any) {
        setRouteUsageAudisa(false)

        return reply.internalServerError(e.message)
      }

      const workbook = readFile(filePath)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const dataXlsx: ExcelDataSchema[] = utils.sheet_to_json(worksheet, {
        header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        blankrows: true,
      })

      const regexAccount = new RegExp(/^\d\.\d\.\d\.\d{2}\.\d{5}$/)

      let contaAtual = ''

      const registers: ExcelDataTransformed[] = []

      let colMap: Record<string, keyof ExcelDataSchema> = {} as any

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
          const keys = Object.keys(register) as (keyof ExcelDataSchema)[]

          colMap = {
            data: keys[normalizedRows.findIndex((c) => c === 'DATA')],
            lote: keys[normalizedRows.findIndex((c) => c === 'LOTE')],
            lanc: keys[normalizedRows.findIndex((c) => c === 'LANC')],
            cPartida: keys[normalizedRows.findIndex((c) => c === 'C/PARTIDA')],
            historico: keys[normalizedRows.findIndex((c) => c === 'HISTORICO')],
            debito: keys[normalizedRows.findIndex((c) => c === 'DEBITO')],
            credito: keys[normalizedRows.findIndex((c) => c === 'CREDITO')],
            saldo: keys[normalizedRows.findIndex((c) => c === 'SALDO')],
          }
        } else if (Object.values(register).length > 3) {
          const data: string | null = register[colMap.data] ?? null
          const lote: string | null = register[colMap.lote] ?? null
          const lanc: string | null = register[colMap.lanc] ?? null
          const cPartida: string | null = register[colMap.cPartida] ?? null
          const historico: string | null = register[colMap.historico] ?? null
          const debito: string | null = register[colMap.debito] ?? null
          const credito: string | null = register[colMap.credito] ?? null
          const saldo: string | null = register[colMap.saldo] ?? null

          let dataTransformed: string | null = null

          if (data && data.includes('/')) {
            const valoresData = data.split('/')

            if (valoresData.length !== 3) {
              dataTransformed = null
            } else {
              const [diaJs, mesJs, anoJs] = valoresData

              dataTransformed = `${anoJs}-${mesJs}-${diaJs}`
            }
          } else if (data && data.includes('-')) {
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

          let contaPartida: string | null = null
          if (
            cPartida &&
            !regexAccount.test(cPartida) &&
            normalize(cPartida) !== 'MULTIPLO'
          ) {
            contaPartida = null
          } else {
            contaPartida = cPartida
          }

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

        setRouteUsageAudisa(false)

        unlinkSync(filePath)

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
            validacao varchar(50)
          )
        `)
      } catch (e: any) {
        unlinkSync(filePath)

        setRouteUsageAudisa(false)

        return reply.internalServerError(e.message)
      }

      const comandos = toSQLInsert(registers, empresa)

      const { inserted_data: registrosInseridos } = await runBatchInChunks(
        comandos,
        db,
      )

      unlinkSync(filePath)

      setRouteUsageAudisa(false)

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
