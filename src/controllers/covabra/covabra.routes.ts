import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { covabraRequestDb } from './routes/covabraRequestDb'
import { exportPptx } from './routes/exportPptx'

export function covabraRoutes(app: FastifyZodTypedInstance) {
  app.register(covabraRequestDb)
  app.register(exportPptx)
}
