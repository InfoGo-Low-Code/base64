import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { z } from 'zod'
import covabra from '@/database/covabra'

export function covabraRequestDb(app: FastifyZodTypedInstance) {
  app.post(
    '/covabra/requestDb',
    {
      schema: {
        body: z.object({
          query: z.string(),
        }),
        response: {
          200: z.object({
            result: z.any(),
          }),
          500: z.any(),
        },
      },
    },
    async (request, reply) => {
      const { query } = request.body

      try {
        const result = await covabra.unsafe(query)

        return reply
          .header('Access-Control-Allow-Origin', 'https://app.infogo.com.br')
          .send({ result })
      } catch (error: any) {
        console.error('❌ Erro ao executar query:', error)

        return reply
          .header('Access-Control-Allow-Origin', 'https://app.infogo.com.br')
          .status(500)
          .send({
            message: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail,
            position: error.position,
            routine: error.routine,
            query,
          })
      }
    },
  )
}
