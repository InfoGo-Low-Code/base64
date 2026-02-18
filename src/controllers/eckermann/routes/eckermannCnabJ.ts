import { FastifyZodTypedInstance } from "@/@types/fastifyZodTypedInstance"
import { z } from "zod"
import { getEckermannConnection } from "@/database/eckermann"
import { MyCNABGenerator, SegmentoJO } from "@/utils/eckermann/myCnab240Generator"

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

export function eckermannCnabJ(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/cnabJ',
    {
      schema: {
        body: z.object({
          empresa: z.string(),
        }),
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

      const { recordset } = await db.query<SegmentoJO[]>(`
        SELECT
          id,
          codigoBarras,
          linhaDigitavel,
          nomeBeneficiario,
          inscricaoBeneficiario,
          dataVencimentoBoleto,
          dataPagamento,
          valor,
          orgao
        FROM dbo.eckermann_tecnojuris
        WHERE codigoBarras IS NOT NULL
          -- AND efetivado = 0
      `)

      if (!recordset.length) {
        return reply.badRequest('Nenhum boleto disponível para CNAB')
      }

      const { recordset: lotes } = await db.query<{ numero: number }>(`
        SELECT TOP 1
          numero
        FROM eckermann_lote_cnab  
        ORDER BY numero DESC
      `)

      let ultimoLote = 0

      if (lotes.length > 1) {
        ultimoLote = lotes[0].numero
      }

      const generator = new MyCNABGenerator()
      const cnabContent = generator.gerarCnab(ultimoLote, recordset)

      const filename = `CNAB240_TECNOJURIS_31_${Date.now()}.REM`

      return reply.send({
        filename,
        mimeType: 'text/plain',
        contentBase64: Buffer.from(cnabContent).toString('base64'),
      })
    }
  )
}
