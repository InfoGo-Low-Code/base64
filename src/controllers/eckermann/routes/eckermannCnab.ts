import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { getEckermannConnection } from '@/database/eckermann'
import { TecnoJurisSchema, tecnoJurisSchema } from '@/schemas/eckermann/tecnoJurisSchema'
import { CNAB240Generator } from '@/utils/eckermann/cnab240Generator'
import { writeFile } from 'node:fs/promises'
import { z } from 'zod'

export function eckermannCnab(app: FastifyZodTypedInstance) {
  app.get(
    '/eckermann/cnab',
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
        USE dw_hmetrix;

        SELECT
          id,
          cliente,
          descricao,
          FORMAT(data, 'dd/MM/yyyy') as data_formatada,
          usuario,
          pasta,
          partesContrarias,
          tipo,
          unidade,
          natureza,
          valor,
          efetivado,
          faturado,
          tipoInscricaoFavorecido,
          inscricaoFavorecido,
          nomeFavorecido,
          enderecoFavorecido,
          bairroFavorecido,
          cidadeFavorecido,
          cepFavorecido,
          ufFavorecido
        FROM dbo.eckermann_tecnojuris
		    WHERE tipoInscricaoFavorecido IS NOT NULL
        ORDER BY data;
      `)

      if (recordset.length === 0) {
        return reply.badRequest('Nenhum registro disponível para CNAB')
      }

      const generator = new CNAB240Generator()
      const cnabContent = generator.generate(recordset)

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `CNAB240_REMESSA_${timestamp}.REM`

      // await writeFile(filename, cnabContent, 'utf-8')
      // await writeFile(filename.replace('.REM', '.txt'), cnabContent, 'utf-8')

      console.log(
        `[CNAB] Gerado em ${new Date().toISOString()} | Registros: ${recordset.length}`
      )

      const cnabBase64 = Buffer
        .from(cnabContent, 'utf-8')
        .toString('base64')

      return reply.send({
        filename,
        mimeType: 'text/plain',
        contentBase64: cnabBase64,
      })
    },
  )
}
