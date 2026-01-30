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
        response: {
          200: z.object({
            base64: z.string(),
          })
        }
      },
    },
    async (request, reply) => {
      const { registros } = request.body

      const idsFormatados = registros.join("', '")

      const db = await getEckermannConnection()

      try {
        const { recordset } = await db.query<TecnoJuris[]>(`
          USE dw_hmetrix;

          SELECT
            data AS 'DATA',
            cliente AS 'CLIENTE',
            CASE
                WHEN cliente LIKE '%(%)%' THEN
                    SUBSTRING(
                        cliente,
                        CHARINDEX('(', cliente) + 1,
                        CHARINDEX(')', cliente) - CHARINDEX('(', cliente) - 1
                    )
                ELSE
                    'CÍVEL'
            END AS 'CARTEIRA',
            poloCliente AS 'PÓLO',
            tipo AS 'TIPO DE DESPESA',
            descricao AS 'DESCRIÇÃO DA DESPESA',
            distribuicao AS 'PROCESSO',
            partesContrarias AS 'NOME DE IDENTIFICAÇÃO',
            pasta AS 'COD. CLIENTE',
            banco AS 'BANCO',
            valor AS 'VALOR',
            CASE
              WHEN efetivado = 1 THEN 'PAGO'
              ELSE 'PENDENTE'
            END AS 'PAGO',
            '' AS 'BANCO PAGAMENTO',
            usuario AS 'ADICIONADO POR',
            CASE
              WHEN cliente IN (
              'BANCO PAN S.A',
              'SYSTEMCRED',
              'BACKSEG – GESTÃO DE DOCUMENTOS E RECEBÍVEIS LTDA'
              )
              THEN 'Cliente Bloqueado - Pagamento'
              ELSE validacao
            END AS 'OBS',
            unidade AS 'UNIDADE',
            CASE 
              WHEN DATENAME(WEEKDAY, DATEADD(DAY, 1, data)) IN ('Saturday', 'domingo', 'Saturday', 'Sábado') THEN 
                  DATEADD(DAY, 3, data)

              WHEN DATENAME(WEEKDAY, DATEADD(DAY, 1, data)) IN ('Sunday', 'domingo', 'Sunday', 'Domingo') THEN 
                  DATEADD(DAY, 2, data)

              ELSE 
                  DATEADD(DAY, 1, data)
          END AS 'DIA DO PAGAMENTO'
          FROM dbo.eckermann_tecnojuris
          WHERE id IN ('${idsFormatados}')
        `)

        const buffer = await createTecnoJurisExcel(recordset)

        const base64 = buffer.toString('base64')

        return reply.send({ base64 })
      } catch (error: any) {
        return reply.internalServerError(error.message)
      }
    },
  )
}
