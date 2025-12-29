import { FastifyZodTypedInstance } from "@/@types/fastifyZodTypedInstance"
import { z } from "zod"
import { getEckermannConnection } from "@/database/eckermann"
import { TecnoJurisSchema } from "@/schemas/eckermann/tecnoJurisSchema"
import { CNAB240PagamentoBoletoGenerator } from "@/utils/eckermann/cnab240SegPGenerator"

// =========================
// Função de próx. dia útil
// =========================
function proximoDiaUtil(data: Date): Date {
  const novaData = new Date(data)

  // soma 1 dia
  novaData.setDate(novaData.getDate() + 1)

  // 0 = domingo | 6 = sábado
  while (novaData.getDay() === 0 || novaData.getDay() === 6) {
    novaData.setDate(novaData.getDate() + 1)
  }

  return novaData
}

export function eckermannCnabP(app: FastifyZodTypedInstance) {
  app.get(
    '/eckermann/cnabP',
    {
      schema: {
        response: {
          200: z.object({
            filename: z.string(),
            mimeType: z.string(),
            contentBase64: z.string(),
          }),
        },
      },
    },
    async (_, reply) => {
      const db = await getEckermannConnection()

      const { recordset } = await db.query<TecnoJurisSchema[]>(`
        SELECT
          id,
          valor,
          data,
          codigoBarras,
          dataPagamento
        FROM dbo.eckermann_tecnojuris
        WHERE codigoBarras IS NOT NULL
          AND efetivado = 0
      `)

      if (!recordset.length) {
        return reply.badRequest('Nenhum boleto disponível para CNAB')
      }

      const generator = new CNAB240PagamentoBoletoGenerator()
      const cnabContent = generator.generate(recordset)

      const filename = `CNAB240_BOLETOS_${Date.now()}.REM`

      return reply.send({
        filename,
        mimeType: 'text/plain',
        contentBase64: Buffer.from(cnabContent).toString('base64'),
      })
    }
  )
}
