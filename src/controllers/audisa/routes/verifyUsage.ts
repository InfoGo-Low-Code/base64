import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { getRouteUsageAudisa, getUserUsage } from '@/utils/audisa/routeUsage'
import { z } from 'zod'

export function verifyUsage(app: FastifyZodTypedInstance) {
  app.get(
    '/audisa/verifyUsage',
    {
      schema: {
        response: {
          200: z.object({
            routeUsage: z.boolean(),
            userUsage: z.string(),
          }),
        },
      },
    },
    async (_, reply) => {
      const routeUsage = getRouteUsageAudisa()
      const userUsage = getUserUsage()

      reply.send({ routeUsage, userUsage })
    },
  )
}
