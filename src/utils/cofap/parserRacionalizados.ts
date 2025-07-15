import { readFile, utils } from 'xlsx'
import {
  racionalizadosSchema,
  RacionalizadosSchema,
} from '@/schemas/cofap/infocode/racionalizadosSchema'
import { z } from 'zod'

export const racionalizadosResponseSchema = racionalizadosSchema.extend({
  Comercializado: z.string(),
})

export type RacionalizadosResponseSchema = z.infer<
  typeof racionalizadosResponseSchema
>

export function parserRacionalizados(
  filePath: string,
): RacionalizadosResponseSchema[] {
  const workbook = readFile(filePath)
  const sheetname = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetname]

  const dataXlsx: RacionalizadosSchema[] = utils.sheet_to_json(worksheet, {
    header: ['Produto', 'CodigoProduto', 'Descricao', 'Comercializado'],
    range: 1,
  })

  const produtos: RacionalizadosResponseSchema[] = dataXlsx.map((produto) => ({
    ...produto,
    Comercializado: produto.Comercializado ? 'VERDADEIRO' : 'FALSO',
  }))

  return produtos
}
