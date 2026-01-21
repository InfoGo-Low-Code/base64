import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { covabraRequestDb } from './routes/covabraRequestDb'
import { exportPptx } from './routes/exportPptx'
import { exportExcel } from './routes/exportExcel'
import { exportPptxMultiple } from './routes/exportPptxMultiple'

export function covabraRoutes(app: FastifyZodTypedInstance) {
  app.register(covabraRequestDb)
  app.register(exportPptx)
  app.register(exportExcel)
  app.register(exportPptxMultiple)
}
