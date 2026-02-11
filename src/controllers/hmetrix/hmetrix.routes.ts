import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { importExams } from './routes/importExams'

export function hmetrixRoutes(app: FastifyZodTypedInstance) {
  app.register(importExams)
}
