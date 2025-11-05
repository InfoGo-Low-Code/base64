import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { getUserUsage } from '@/utils/audisa/routeUsage'
import { z } from 'zod'

export function verifyUsage(app: FastifyZodTypedInstance) {
  app.get(
    '/audisa/verifyUsage',
    {
      schema: {
        response: {
          200: z.object({
            userUsage: z.array(z.string()),
          }),
        },
      },
    },
    async (_, reply) => {
      const userUsage = getUserUsage()

      reply.send({ userUsage })
    },
  )
}
