import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { getEckermannConnection } from '@/database/eckermann'
import { createTecnoJurisExcel } from '@/utils/eckermann/createTecnoJurisExcel'
import { z } from 'zod'

export type TecnoJuris = {
  data: string
  cliente: string
  carteira: string
  polo: string
  tipo: string
  descricao: string
  processoId: string
  partesContrarias: string
  pasta: string
  valor: number
  efetivado: string
  usuario: string
  validacao: string
  unidade: string
}

export function eckermannExcelTecnoJuris(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/excelTecnoJuris',
    {
      schema: {
        body: z.object({
          registros: z.array(z.string()),
        }),
      },
    },
    async (request, reply) => {
      const { registros } = request.body

      const idsFormatados = registros.join("', '")

      const db = await getEckermannConnection()

      try {
        const { recordset } = await db.query<TecnoJuris[]>(`
          SELECT
            data AS 'DATA',
            cliente AS 'CLIENTE',
            CASE
              WHEN cliente LIKE '%(%)%' 
                AND RIGHT(LTRIM(RTRIM(cliente)), 1) = ')'
              THEN
              SUBSTRING(
                cliente,
                LEN(cliente) - CHARINDEX('(', REVERSE(cliente)) + 2,
                LEN(cliente) - (LEN(cliente) - CHARINDEX('(', REVERSE(cliente)) + 2)
              )
              ELSE
              'NÃO INFORMADO'
            END AS 'CARTEIRA',
            poloCliente AS 'PÓLO',
            tipo AS 'TIPO DE DESPESA',
            descricao AS 'DESCRIÇÃO DA DESPESA',
            processoId AS 'PROCESSO',
            partesContrarias AS 'NOME DE IDENTIFICAÇÃO',
            pasta AS 'COD. CLIENTE',
            '' AS 'BANCO',
            valor AS 'VALOR',
            CASE
              WHEN efetivado = 1 THEN 'PAGO'
              ELSE 'PENDENTE'
            END AS 'PAGO',
            '' AS 'BANCO PAGAMENTO',
            usuario AS 'ADICIONADO POR',
            validacao AS 'OBS',
            unidade AS 'UNIDADE',
            CASE 
              WHEN DATENAME(WEEKDAY, DATEADD(DAY, 1, data)) IN ('Saturday', 'domingo', 'Saturday', 'Sábado') THEN 
                  DATEADD(DAY, 3, data)

              WHEN DATENAME(WEEKDAY, DATEADD(DAY, 1, data)) IN ('Sunday', 'domingo', 'Sunday', 'Domingo') THEN 
                  DATEADD(DAY, 2, data)

              ELSE 
                  DATEADD(DAY, 1, data)  -- Caso normal
          END AS 'DIA DO PAGAMENTO'
          FROM dbo.eckermann_tecnojuris
          WHERE id IN ('${idsFormatados}')
        `)

        const buffer = await createTecnoJurisExcel(recordset)

        return reply
          .header(
            'content-type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          )
          .header('content-disposition', `attachment; filename=TECNOJURIS.xlsx`)
          .send(buffer)
      } catch (error: any) {
        return reply.internalServerError(error.message)
      }
    },
  )
}
