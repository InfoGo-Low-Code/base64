import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifySwagger as fpSwagger } from '@fastify/swagger'
import { jsonSchemaTransform } from 'fastify-type-provider-zod'

export async function fastifySwagger(app: FastifyZodTypedInstance) {
  await app.register(fpSwagger, {
    openapi: {
      info: {
        title: 'infocode api docs',
        version: '1.0.0',
        description:
          'This app is responsible to manage all requests related to upload files to infocode project',
      },
    },
    transform: jsonSchemaTransform,
  })
}
