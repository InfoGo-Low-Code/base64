import { ExtratoSchema } from '@/schemas/eckermann/extratoSchema'
import { z } from 'zod'
import { parserXlsxOrXls } from './parserXlsxOrXls'
import { formatDate } from '../formatDate'
import { excelDateToJSDate } from '../parseXlsxDate'

const excelSchema = z.object({
  data: z.union([z.string(), z.number()]),
  lancamento: z.string(),
  agencia_origem: z.string(),
  valor: z.coerce.number().optional(),
  saldo: z.coerce.number().optional(),
})

type ExcelSchema = z.infer<typeof excelSchema>

export function parserItau(
  filePath: string,
  empresa: string,
  filename: string,
): ExtratoSchema[] {
  const rawData = parserXlsxOrXls(filePath, 'ITAÚ')

  const dataXlsx = rawData.map((item) =>
    excelSchema.parse(item),
  ) as ExcelSchema[]

  const filteredDataXlsx = dataXlsx.filter((register) => {
    if (register.valor) {
      return register
    }
  })

  const formattedData: ExtratoSchema[] = filteredDataXlsx.map((register) => {
    let data

    if (typeof register.data === 'string') {
      const [day, month, year] = register.data.split('/')
      data = `${year}-${month}-${day}`
    } else {
      const dataJs = excelDateToJSDate(register.data)
      data = formatDate(dataJs)
    }

    const descricao = register.lancamento

    const valor = register.valor! < 0 ? register.valor! * -1 : register.valor!

    const nome_relatorio = filename

    const banco = 'ITAÚ'

    const status = 0

    const status_texto = 'PENDENTE'

    const tipo_transacao = register.valor! < 0 ? 'D' : 'C'

    const id = `${data}&${descricao}&${valor}&${banco}&${empresa}&${tipo_transacao}`

    return {
      id,
      data,
      descricao,
      valor: Number(valor),
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
