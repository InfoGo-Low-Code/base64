import { ExtratoSchema } from '@/schemas/eckermann/extratoSchema'
import { z } from 'zod'
import { excelDateToJSDate } from '../parseXlsxDate'
import { formatDate } from '../formatDate'
import { parserXlsxOrXls } from './parserXlsxOrXls'

const excelSchema = z.object({
  data: z.number(),
  lancamento: z.string(),
  conta: z.string(),
  valor: z.number(),
})

type ExcelSchema = z.infer<typeof excelSchema>

export function parserSantander(
  filePath: string,
  empresa: string,
  filename: string,
): ExtratoSchema[] {
  const rawData = parserXlsxOrXls(filePath, 'SANTANDER')

  const dataXlsx = rawData.map((item) =>
    excelSchema.parse(item),
  ) as ExcelSchema[]

  const formattedData: ExtratoSchema[] = dataXlsx.map((register) => {
    const dataJs = excelDateToJSDate(register.data)
    const data = formatDate(dataJs)

    const descricao = register.lancamento

    const valor = register.valor < 0 ? register.valor * -1 : register.valor

    const nome_relatorio = filename

    const banco = 'BRADESCO'

    const status = 0

    const status_texto = 'PENDENTE'

    const tipo_transacao = register.valor < 0 ? 'D' : 'C'

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
