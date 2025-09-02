import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { getImgSellers, getNamesSellers, getSellValue } from '@/utils/invistaii/routeUsage'
import { z } from 'zod'

export function verifySell(app: FastifyZodTypedInstance) {
  app.get(
    '/invistaii/verifySell',
    {
      schema: {
        response: {
          200: z.object({
            vendedores: z.array(z.string()),
            imagens: z.array(z.string()),
            valorVenda: z.number(),
          }),
        },
      },
    },
    async (_, reply) => {
      const vendedores = getNamesSellers()
      const imagens = getImgSellers()
      const valorVenda = getSellValue()

      reply.send({ vendedores, imagens, valorVenda })
    },
  )
}
