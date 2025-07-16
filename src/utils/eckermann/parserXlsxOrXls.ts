import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { z } from 'zod'

const bancoEnum = z.enum(['BANCO DO BRASIL', 'BRADESCO', 'ITAÚ', 'SANTANDER'])

type BancoEnum = z.infer<typeof bancoEnum>

export function parserXlsxOrXls(filePath: string, banco: BancoEnum): any[] {
  const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' })

  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const header =
    banco === 'BANCO DO BRASIL'
      ? [
          'data',
          'observacao',
          'data_balance',
          'agencia_origem',
          'lote',
          'numero_documento',
          'codigo_historico',
          'historico',
          'valor',
          'tipo_transacao',
          'detalhamento_historico',
        ]
      : banco === 'BRADESCO'
        ? ['data', 'lancamento', 'documento', 'credito', 'debito']
        : banco === 'ITAÚ'
          ? ['data', 'lancamento', 'agencia_origem', 'valor', 'saldo']
          : ['data', 'lancamento', 'conta', 'valor']

  const range =
    banco === 'BANCO DO BRASIL'
      ? 3
      : banco === 'BRADESCO'
        ? 9
        : banco === 'ITAÚ'
          ? 10
          : 2

  const json = XLSX.utils.sheet_to_json(sheet, { header, range })

  return json
}
