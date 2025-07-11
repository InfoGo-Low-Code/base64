import { ExtratoSchema } from "@/schemas/eckermann/extratoSchema"
import { readFile, utils } from "xlsx"
import { z } from "zod"
import { excelDateToJSDate } from "../parseXlsxDate"
import { formatDate } from "../formatDate"

const excelSchema = z.object({
  data: z.number(),
  lancamento: z.string(),
  agencia_origem: z.string(),
  valor: z.number().optional(),
  saldo: z.number().optional(),
})

type ExcelSchema = z.infer<typeof excelSchema>

export function parserItau(filePath: string, empresa: string, filename: string): ExtratoSchema[] {
  const workbook = readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const dataXlsx: ExcelSchema[] = utils.sheet_to_json(
    worksheet,
    {
      header: [
        'data',
        'lançamento',
        'agencia_origem',
        'valor',
        'saldo',
      ],
      range: 10,
    }
  )

  const filteredDataXlsx = dataXlsx.filter((register) => {
    if (register.valor) {
      return register
    }
  })

  const formattedData: ExtratoSchema[] = filteredDataXlsx.map((register) => {
    const dataJs = excelDateToJSDate(register.data)
    const data = formatDate(dataJs)

    const descricao = register.lancamento

    const valor = register.valor! < 0 ? register.valor! * -1 : register.valor!

    const nome_relatorio = filename

    const banco = 'BRADESCO'

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