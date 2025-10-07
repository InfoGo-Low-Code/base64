import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { covabraRequestDb } from './routes/covabraRequestDb'

export function covabraRoutes(app: FastifyZodTypedInstance) {
  app.register(covabraRequestDb)
}
