import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { eckermannContasReceber } from './routes/eckermannContasReceber'
import { returnExcelDataEckermann } from './routes/returnExcelDataEckermann'
import { returnExtratoData } from './routes/returnExtratoData'


export function eckermannRoutes(app: FastifyZodTypedInstance) {
  app.register(eckermannContasReceber)
  app.register(returnExcelDataEckermann)
  app.register(returnExtratoData)
}
