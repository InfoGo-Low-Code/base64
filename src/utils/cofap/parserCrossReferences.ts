import { readFile, utils } from 'xlsx'
import { CrossReferencesSchema } from '@/schemas/cofap/infocode/crossReferencesSchema'

export function parserCrossReferences(
  filePath: string,
): CrossReferencesSchema[] {
  const workbook = readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  const dataXlsx: CrossReferencesSchema[] = utils.sheet_to_json(worksheet, {
    header: ['Produto', 'DescFabricante', 'NumeroProdutoPesq'],
    range: 1,
  })

  return dataXlsx
}
