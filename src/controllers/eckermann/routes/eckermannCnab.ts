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
            cnabContent: z.string(),
          }),
        },
      },
    },
    async (_, reply) => {
      const db = await getEckermannConnection()

      const { recordset } = await db.query<TecnoJurisSchema[]>(`
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
          faturado
        FROM dbo.eckermann_tecnojuris
        WHERE faturado = 0
        ORDER BY data
      `)

      const generator = new CNAB240Generator()
      const cnabContent = generator.generate(recordset)

      await writeFile('CNAB240_REMESSA.REM', cnabContent, 'utf-8')
      await writeFile('CNAB240_REMESSA.txt', cnabContent, 'utf-8')

      return reply.send({
        cnabContent,
      })
    },
  )
}
