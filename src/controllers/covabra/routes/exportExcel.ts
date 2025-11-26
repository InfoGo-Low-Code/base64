import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { z } from 'zod'
import * as XLSX from 'xlsx'

export function exportExcel(app: FastifyZodTypedInstance) {
  app.post(
    '/covabra/exportExcel',
    {
      schema: {
        body: z.object({
          header: z.array(z.string()),
          labels: z.array(z.string()),
          data: z.array(z.array(z.number().transform(n => Number(n.toFixed(2)))))
        }),
        response: {
          200: z.object({
            base64: z.string(),
          })
        }
      },
    },
    async (request, reply) => {
      const { header, labels, data } = request.body

      try {
        const workbook = XLSX.utils.book_new()

        const table: any[][] = []

        // 1. Cabeçalho (primeira linha)
        table.push(labels)

        // 2. Cada linha por mês
        header.forEach((month, index) => {
          const row: (string | number)[] = [month]

          // para cada série do "data"
          data.forEach(series => {
            row.push(series[index] ?? null)
          })

          table.push(row)
        })

        // 3. Gerar sheet
        const worksheet = XLSX.utils.aoa_to_sheet(table)

        // 4. Adicionar ao workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, "Planilha")

        // 5. Gerar base64
        const base64 = XLSX.write(workbook, {
          type: "base64",
          bookType: "xlsx",
        })

        return reply.send({ base64 })
      } catch (error: any) {
        console.warn(error)
        return reply.internalServerError(`Erro ao realizar exportação em EXCEL: ${error.message}`)
      }
    },
  )
}
