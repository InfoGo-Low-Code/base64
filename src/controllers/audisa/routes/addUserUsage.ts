import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { setUserUsage } from '@/utils/audisa/routeUsage'
import { z } from 'zod'

export function addUsage(app: FastifyZodTypedInstance) {
  app.post(
    '/audisa/addUsage',
    {
      schema: {
        body: z.object({
          user: z.string(),
        })
      },
    },
    async (request, reply) => {
      const { user } = request.body

      setUserUsage(user)

      reply.send()
    },
  )
}
