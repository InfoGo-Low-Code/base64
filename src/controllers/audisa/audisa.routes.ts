import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { readExcelData } from './routes/readExcelData'

export function audisaRoutes(app: FastifyZodTypedInstance) {
  app.register(readExcelData)
}
