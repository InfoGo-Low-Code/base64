import {
  ProdutoSimilarSchema,
  produtoSimilarSchema,
} from '@/schemas/cofap/infocode/produtoSimilarSchema'
import { readFile, utils } from 'xlsx'
import { z } from 'zod'

export const produtoSimilarResponseSchema = produtoSimilarSchema.extend({
  Comercializado: z.string(),
})

export type ProdutoSimilarResponseSchema = z.infer<
  typeof produtoSimilarResponseSchema
>

export function parserProdutoSimilar(
  filePath: string,
): ProdutoSimilarResponseSchema[] {
  const workbook = readFile(filePath)
  const sheetname = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetname]

  const dataXlsx: ProdutoSimilarSchema[] = utils.sheet_to_json(worksheet, {
    header: ['Produto', 'CodigoProdutoSimilar', 'Descricao', 'Comercializado'],
    range: 1,
  })

  const produtos: ProdutoSimilarResponseSchema[] = dataXlsx.map((produto) => ({
    ...produto,
    Comercializado: produto.Comercializado ? 'VERDADEIRO' : 'FALSO',
  }))

  return produtos
}
