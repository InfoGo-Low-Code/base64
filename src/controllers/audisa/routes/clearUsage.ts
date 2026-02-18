import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { clearUserUsage, getUserUsage } from '@/utils/audisa/routeUsage'
import { z } from 'zod'

export function clearUsage(app: FastifyZodTypedInstance) {
  app.get(
    '/audisa/clearUsage',
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
      clearUserUsage()

      const userUsage = getUserUsage()

      reply.send({ userUsage })
    },
  )
}
