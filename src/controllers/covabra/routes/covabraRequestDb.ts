import { FastifyZodTypedInstance } from "@/@types/fastifyZodTypedInstance"
import { z } from "zod"
import covabra from '@/database/covabra'

export function covabraRequestDb(app: FastifyZodTypedInstance) {
  app.post(
    '/covabra/requestDb',
    {
      schema: {
        body: z.object({
          query: z.string(),
        })
      }
    },
    async (request, reply) => {
      const { query } = request.body

      const result = await covabra.unsafe(query)

      console.log(result)
    }
  )
}
