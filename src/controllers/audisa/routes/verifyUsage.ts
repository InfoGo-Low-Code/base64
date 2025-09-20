import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { getRouteUsageAudisa } from '@/utils/audisa/routeUsage'
import { z } from 'zod'

export function verifyUsage(app: FastifyZodTypedInstance) {
  app.get(
    '/audisa/verifyUsage',
    {
      schema: {
        response: {
          200: z.object({
            routeUsage: z.boolean(),
          }),
        },
      },
    },
    async (_, reply) => {
      const routeUsage = getRouteUsageAudisa()

      reply.send({ routeUsage })
    },
  )
}
