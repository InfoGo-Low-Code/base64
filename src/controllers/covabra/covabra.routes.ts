import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { covabraRequestDb } from './routes/covabraRequestDb'
import { exportPptx } from './routes/exportPptx'
import { exportExcel } from './routes/exportExcel'

export function covabraRoutes(app: FastifyZodTypedInstance) {
  app.register(covabraRequestDb)
  app.register(exportPptx)
  app.register(exportExcel)
}
