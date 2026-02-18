import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { z } from 'zod'

const linha = z.object({
  codigoBarras: z.string(),
  valorTitulo: z.string(),
  valorDesconto: z.string(),
  valorMulta: z.string(),
  valorPagamento: z.string(),
})

type Linha = z.infer<typeof linha>

export function arquivoOmieCnab(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/arquivoOmieCnab',
    {
      schema: {
        body: z.object({
          base64: z.string(),
        }),
        response: {
          200: z.object({
            linhas: z.array(linha),
            valorTrailerLote: z.string(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      }
    },
    async (request, reply) => {
      const { base64 } = request.body

      const decodedBase64 = atob(base64)

      const textSplit = decodedBase64.split('\r\n')

      const linhas: Linha[] = []

      let valorTrailerLote = ''

      textSplit.forEach((linha, idx) => {
        if (idx > 1 && idx % 2 === 0 && idx !== textSplit.length - 2) {
          const codigoBarras = linha.slice(17, 61)
          const valorTitulo = linha.slice(99, 114)
          const valorDesconto = linha.slice(114, 129)
          const valorMulta = linha.slice(129, 144)
          const valorPagamento = linha.slice(152, 167)
          
          linhas.push({
            codigoBarras,
            valorTitulo,
            valorDesconto,
            valorMulta,
            valorPagamento
          })
        } else if (idx === textSplit.length - 2) {
          valorTrailerLote = linha.slice(23, 41)
        }
      })

      return reply.send({
        linhas,
        valorTrailerLote,
      })

      // return reply.send({
      //   linhas: textSplit,
      // })
    }
  )
}
