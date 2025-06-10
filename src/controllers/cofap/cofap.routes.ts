import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { cofapProdutos } from './routes/cofapProdutos'
import { cofapRacionalizados } from './routes/cofapRacionalizados'
import { cofapComunizados } from './routes/cofapComunizados'
import { cofapTrocaCodigo } from './routes/cofapTrocaCodigo'
import { cofapVersoes } from './routes/cofapVersoes'
import { cofapCrossReferences } from './routes/cofapCrossReferences'

export function cofapRoutes(app: FastifyZodTypedInstance) {
  app.register(cofapProdutos)
  app.register(cofapRacionalizados)
  app.register(cofapComunizados)
  app.register(cofapTrocaCodigo)
  app.register(cofapVersoes)
  app.register(cofapCrossReferences)
}
