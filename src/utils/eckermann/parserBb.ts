import { ExtratoSchema } from '@/schemas/eckermann/extratoSchema'
import { z } from 'zod'
import { excelDateToJSDate } from '../parseXlsxDate'
import { formatDate } from '../formatDate'
import { parserXlsxOrXls } from './parserXlsxOrXls'

const excelSchema = z.object({
  data: z.number(),
  observacao: z.string(),
  data_balance: z.string(),
  agencia_origem: z.string(),
  lote: z.string(),
  numero_documento: z.string(),
  codigo_historico: z.string(),
  historico: z.string(),
  valor: z.number(),
  tipo_transacao: z.string(),
  detalhamento_historico: z.string(),
})

type ExcelSchema = z.infer<typeof excelSchema>

export function parserBb(
  filePath: string,
  empresa: string,
  filename: string,
): ExtratoSchema[] {
  const rawData = parserXlsxOrXls(filePath, 'BANCO DO BRASIL')

  const dataXlsx = rawData.map((item) => 
    excelSchema.parse(item)
  ) as ExcelSchema[]

  const formattedData: ExtratoSchema[] = dataXlsx.map((register) => {
    const dataJs = excelDateToJSDate(register.data)
    const data = formatDate(dataJs)

    const descricao =
      register.detalhamento_historico.trim() !== ''
        ? register.detalhamento_historico
        : 'Não informado'

    const valor = register.valor

    const nome_relatorio = filename

    const banco = 'BANCO DO BRASIL'

    const status = 0

    const status_texto = 'PENDENTE'

    const tipo_transacao = register.tipo_transacao

    const id = `${data}&${descricao}&${valor}&${banco}&${empresa}&${tipo_transacao}`

    return {
      id,
      data,
      descricao,
      valor,
      nome_relatorio,
      banco,
      status,
      status_texto,
      empresa,
      tipo_transação: tipo_transacao,
    }
  })

  return formattedData
}
