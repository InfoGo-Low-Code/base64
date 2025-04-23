import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { env } from '@/env'
import axios from 'fastify-axios'

export async function fastifyAxios(app: FastifyZodTypedInstance) {
  app.register(axios, {
    baseURL: 'https://rolezeiro.pythonanywhere.com',
    headers: {
      infogoKey: env.INFOGO_KEY,
    },
  })
}
