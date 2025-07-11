import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { eckermannContasReceber } from './routes/eckermannContasReceber'
import { returnExcelDataEckermann } from './routes/returnExcelDataEckermann'


export function eckermannRoutes(app: FastifyZodTypedInstance) {
  app.register(eckermannContasReceber)
  app.register(returnExcelDataEckermann)
}
