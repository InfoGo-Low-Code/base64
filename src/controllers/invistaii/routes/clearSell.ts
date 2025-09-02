import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import {
  setImgSellers,
  setNamesSellers,
  setSellValue,
} from '@/utils/invistaii/routeUsage'
import { z } from 'zod'

export function clearSell(app: FastifyZodTypedInstance) {
  app.get(
    '/invistaii/clearSell',
    {
      schema: {
        response: {
          200: z.object({ message: z.literal('Atualizado com sucesso') }),
        },
      },
    },
    async (_, reply) => {
      setImgSellers([])
      setNamesSellers([])
      setSellValue(0)

      reply.send({ message: 'Atualizado com sucesso' })
    },
  )
}
