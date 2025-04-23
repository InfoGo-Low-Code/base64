import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifySwaggerUi as fpSwaggerUi } from '@fastify/swagger-ui'

export async function fastifySwaggerUi(app: FastifyZodTypedInstance) {
  await app.register(fpSwaggerUi, {
    routePrefix: '/docs',
  })
}
