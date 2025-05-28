import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyCors as cors } from '@fastify/cors'

export async function fastifyCors(app: FastifyZodTypedInstance) {
  await app.register(cors, {
    origin: '*',
    credentials: true,
  })
}
