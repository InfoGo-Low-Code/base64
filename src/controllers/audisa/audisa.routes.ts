import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { readExcelData } from './routes/readExcelData'
import { verifyUsage } from './routes/verifyUsage'

export function audisaRoutes(app: FastifyZodTypedInstance) {
  app.register(readExcelData)
  app.register(verifyUsage)
}
