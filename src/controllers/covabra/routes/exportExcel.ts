import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { z } from 'zod'
import * as XLSX from 'xlsx'

function formatTwoDecimals(value: number): number {
  if (Number.isInteger(value)) return value // sem casas decimais

  const decimalPlaces = value.toString().split(".")[1]?.length ?? 0

  if (decimalPlaces > 1) {
    return Number(value.toFixed(1))
  }

  return value
}


export function exportExcel(app: FastifyZodTypedInstance) {
  app.post(
    '/covabra/exportExcel',
    {
      schema: {
        body: z.object({
          header: z.array(z.string()).optional(),
          labels: z.array(z.string()).optional(),
          data: z.array(z.array(z.number().transform(n => Number(n.toFixed(2))))).optional(),
          dataExcel: z.array(z.record(z.union([z.string(), z.number(), z.null()]))).optional(),
          totalExcel: z.array(z.string()).optional(),
        }),
        response: {
          200: z.object({
            base64: z.string(),
          })
        }
      },
    },
    async (request, reply) => {
      const { header, labels, data, dataExcel, totalExcel } = request.body

      try {
        let base64

        const workbook = XLSX.utils.book_new()
        
        if (dataExcel && dataExcel.length > 0) {
          const table: any[][] = []

          const header = Object.keys(dataExcel[0])

          table.push(header)

          dataExcel.forEach((data) => {
            const linha: (string | number)[] = []

            Object.entries(data).forEach(([key, value]) => {
              const lowerKey = key.toLowerCase()

              // 1️⃣ Se o campo for STATUS
              if (lowerKey.includes("status")) {
                if (value === 0 || value === "0") {
                  linha.push("NEGATIVO")
                } else {
                  linha.push("POSITIVO")
                }
              } else if (lowerKey.includes('r$') || lowerKey.includes('qnt')) {
                linha.push(Math.round(Number(value)))
              } else if (typeof value === "number") {
                // 2️⃣ Se for número → formata
                linha.push(formatTwoDecimals(value))
              } else if (!value) {
                // 3️⃣ Se for nulo/undefined/vazio → vira 0
                linha.push(0)
              } else {
                // 4️⃣ Caso normal
                linha.push(value)
              }
            })

            table.push(linha)
          })

          const totalLinha: (string | number)[] = []
          totalExcel?.forEach((value, idx) => {
            if (idx === 0) {
              totalLinha.push('TOTAL')
            } else if (value.trim() === '') {
              totalLinha.push('-')
            } else {
              if (value.includes('.')) {
                const formattedValue = value.replace('.', '')

                const numberValue = formatTwoDecimals(Number(formattedValue))

                totalLinha.push(numberValue)
              } else if (!value.includes('icon')) {
                const formattedValue = value.replace(',', '.')

                const numberValue = formatTwoDecimals(Number(formattedValue))

                totalLinha.push(numberValue)
              } else {
                if (value.includes('Positivo')) totalLinha.push('POSITIVO')
                else totalLinha.push('NEGATIVO')
              }
            }
          })
          table.push(totalLinha)

          const worksheet = XLSX.utils.aoa_to_sheet(table)

          XLSX.utils.book_append_sheet(workbook, worksheet, "Planilha")

          // 5. Gerar base64
          base64 = XLSX.write(workbook, {
            type: "base64",
            bookType: "xlsx",
          })
        } else {
          const table: any[][] = []

          // 1. Cabeçalho (primeira linha)
          table.push(labels!)

          // 2. Cada linha por mês
          header!.forEach((month, index) => {
            const row: (string | number)[] = [month]

            // para cada série do "data"
            data!.forEach(series => {
              row.push(series[index] ?? null)
            })

            table.push(row)
          })

          // 3. Gerar sheet
          const worksheet = XLSX.utils.aoa_to_sheet(table)

          // 4. Adicionar ao workbook
          XLSX.utils.book_append_sheet(workbook, worksheet, "Planilha")

          // 5. Gerar base64
          base64 = XLSX.write(workbook, {
            type: "base64",
            bookType: "xlsx",
          })
        }

        // XLSX.writeFile(workbook, './uploads/excel.xlsx')

        return reply.send({ base64 })
      } catch (error: any) {
        console.warn(error)
        return reply.internalServerError(`Erro ao realizar exportação em EXCEL: ${error.message}`)
      }
    },
  )
}
