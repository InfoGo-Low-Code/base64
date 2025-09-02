import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { clearSell } from './routes/clearSell'
import { createSell } from './routes/createSell'
import { verifySell } from './routes/verifySell'

export function invistaiiRoutes(app: FastifyZodTypedInstance) {
  app.register(clearSell)
  app.register(createSell)
  app.register(verifySell)
}
