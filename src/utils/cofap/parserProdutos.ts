import { readFile, utils } from 'xlsx'
import {
  produtosSchema,
  ProdutosSchema,
} from '@/schemas/cofap/infocode/produtosSchema'
import { z } from 'zod'

export const produtoResponseSchema = produtosSchema
  .omit({ Comercializado: true })
  .extend({ Comercializado: z.string() })

export type ProdutoResponseSchema = z.infer<typeof produtoResponseSchema>

export function parserProdutos(filePath: string): ProdutoResponseSchema[] {
  const workbook = readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  const dataXlsx: ProdutosSchema[] = utils.sheet_to_json(worksheet, {
    header: [
      'Marca',
      'Linha',
      'Produto',
      'Posição',
      'Obs',
      'Comercializado',
      'Site',
    ],
    range: 1,
  })

  const produtos: ProdutoResponseSchema[] = dataXlsx.map((produto) => ({
    ...produto,
    Comercializado: produto.Comercializado ? 'VERDADEIRO' : 'FALSO',
  }))

  return produtos
}
