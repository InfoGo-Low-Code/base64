import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyMultipart as multipart } from '@fastify/multipart'

export async function fastifyMultipart(app: FastifyZodTypedInstance) {
  app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  })
}
