import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'

export function parserXlsxOrXls(filePath: string): any[] {
  const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' })

  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  return json
}
