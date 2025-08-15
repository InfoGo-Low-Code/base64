import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { eckermannContasReceber } from './routes/eckermannContasReceber'
import { returnExcelDataEckermann } from './routes/returnExcelDataEckermann'
import { returnExtratoData } from './routes/returnExtratoData'
import { eckermannExtratos } from './routes/eckemannExtratos'
import { solicitacoesPagamento } from './routes/eckermannSolicitacoesPagamento'
import { solicitacaoPagamentoId } from './routes/eckermannSolicitacaoPagamentoId'

export function eckermannRoutes(app: FastifyZodTypedInstance) {
  app.register(returnExcelDataEckermann)
  app.register(eckermannContasReceber)
  app.register(returnExtratoData)
  app.register(eckermannExtratos)
  app.register(solicitacoesPagamento)
  app.register(solicitacaoPagamentoId)
}
