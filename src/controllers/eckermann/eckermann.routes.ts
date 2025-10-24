import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { eckermannContasReceber } from './routes/eckermannContasReceber'
import { returnExcelDataEckermann } from './routes/returnExcelDataEckermann'
import { returnExtratoData } from './routes/returnExtratoData'
import { eckermannExtratos } from './routes/eckemannExtratos'
import { solicitacoesPagamento } from './routes/eckermannSolicitacoesPagamento'
import { solicitacaoPagamentoId } from './routes/eckermannSolicitacaoPagamentoId'
import { updateSolicitacoesPagamentoId } from './routes/eckermannUpdateSolicitacaoId'
import { downloadMultiplosArquivos } from './routes/downloadMultiplosArquivos'
import { eckermannTecnoJuris } from './routes/eckermannTecnoJuris'
import { eckermannExcelTecnoJuris } from './routes/eckermannExcelTecnoJuris'
import { eckermannCnab } from './routes/eckermannCnab'

export function eckermannRoutes(app: FastifyZodTypedInstance) {
  app.register(returnExcelDataEckermann)
  app.register(eckermannContasReceber)
  app.register(returnExtratoData)
  app.register(eckermannExtratos)
  app.register(solicitacoesPagamento)
  app.register(solicitacaoPagamentoId)
  app.register(updateSolicitacoesPagamentoId)
  app.register(downloadMultiplosArquivos)
  app.register(eckermannTecnoJuris)
  app.register(eckermannExcelTecnoJuris)
  app.register(eckermannCnab)
}
