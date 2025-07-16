import { ExtratoSchema } from '@/schemas/eckermann/extratoSchema'
import { z } from 'zod'
import { parserXlsxOrXls } from './parserXlsxOrXls'

const excelSchema = z.object({
  data: z.string(),
  lancamento: z.string().optional(),
  documento: z.coerce.string().optional(),
  credito: z.union([z.string(), z.number()]).optional(),
  debito: z.union([z.string(), z.number()]).optional(),
})

type ExcelSchema = z.infer<typeof excelSchema>

export function parserBradesco(
  filePath: string,
  empresa: string,
  filename: string,
): ExtratoSchema[] {
  const rawData = parserXlsxOrXls(filePath, 'BRADESCO')

  const dataXlsx = rawData.map((item) => 
    excelSchema.parse(item)
  ) as ExcelSchema[]

  const filteredDataXlsx = dataXlsx.filter((register) => {
    if (
      (typeof register.credito === 'number' ||
        typeof register.debito === 'number') &&
      register.lancamento
    ) {
      return register
    }
  })

  const formattedData: ExtratoSchema[] = filteredDataXlsx.map((register) => {
    const [day, month, year] = register.data.split('/')
    const data = `${year}-${month}-${day}`

    const descricao = register.lancamento ? register.lancamento : 'Não Informado'

    const valor =
      typeof register.credito === 'number'
        ? register.credito
        : Number(register.debito)

    const nome_relatorio = filename

    const banco = 'BRADESCO'

    const status = 0

    const status_texto = 'PENDENTE'

    const tipo_transacao = typeof register.credito === 'number' ? 'C' : 'D'

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
