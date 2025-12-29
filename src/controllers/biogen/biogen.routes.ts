import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { formatExcel } from './routes/formatExcel'

export function biogenRoutes(app: FastifyZodTypedInstance) {
  app.register(formatExcel)
}