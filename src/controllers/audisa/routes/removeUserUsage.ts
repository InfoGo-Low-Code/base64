import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { removeUserUsage } from '@/utils/audisa/routeUsage'
import { z } from 'zod'

export function removeUsage(app: FastifyZodTypedInstance) {
  app.post(
    '/audisa/removeUsage',
    {
      schema: {
        body: z.object({
          user: z.string(),
        })
      },
    },
    async (request, reply) => {
      const { user } = request.body

      removeUserUsage(user)

      reply.send()
    },
  )
}
