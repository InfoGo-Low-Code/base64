import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import {
  setImgSellers,
  setNamesSellers,
  setSellValue,
} from '@/utils/invistaii/routeUsage'
import { z } from 'zod'

export function createSell(app: FastifyZodTypedInstance) {
  app.post(
    '/invistaii/createSell',
    {
      schema: {
        body: z.object({
          vendedores: z.array(z.string()),
          imagens: z.array(z.string().url()),
          valorVenda: z.number(),
        }),
        response: {
          200: z.object({ message: z.literal('Vendedor atualizado') }),
        },
      },
    },
    async (request, reply) => {
      const { vendedores, imagens, valorVenda } = request.body

      setNamesSellers(vendedores)
      setImgSellers(imagens)
      setSellValue(valorVenda)

      reply.send({ message: 'Vendedor atualizado' })
    },
  )
}
