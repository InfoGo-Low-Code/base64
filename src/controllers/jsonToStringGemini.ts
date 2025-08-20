import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'

const historicoSchema = z.object({
  HISTORICO: z.string(),
  DATE_HOUR: z.coerce.string(),
})

export function jsonToStringGemini(app: FastifyZodTypedInstance) {
  app.post(
    '/jsonToStringGemini',
    {
      schema: {
        body: z.object({
          data: z.array(historicoSchema),
        }),
        response: {
          200: z.string(),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { data } = request.body

      const orderDataByDataAsc = data.sort((a, b) => {
        return new Date(a.DATE_HOUR).getTime() - new Date(b.DATE_HOUR).getTime()
      })

      let stringReturnGemini = ''

      orderDataByDataAsc.forEach((entry, idx) => {
        const quebraLinha = idx === data.length - 1 ? '' : '\\n\n'

        stringReturnGemini += `${entry.HISTORICO} (${entry.DATE_HOUR})${quebraLinha}`
      })

      return reply.send(stringReturnGemini)
    },
  )
}
