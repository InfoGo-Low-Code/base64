import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { PDFParse } from 'pdf-parse'
import { validarBoleto } from '@mrmgomes/boleto-utils'
import { getEckermannConnection } from '@/database/eckermann'
import { JwtEckermannSchema } from './eckermannTecnoJuris'

export function boletosTecnoJuris(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/boletosTecnoJuris',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
          nomeArquivo: z.string(),
        }),
      }
    },
    async (request, reply) => {
      const { url, nomeArquivo } = request.body

      try {
        const parser = new PDFParse({ url })
        const parsedText = await parser.getText()

        const linhaDigitavel = parsedText.text.match(
          /\b\d{5}[.\s]?\d{5}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d[.\s]?\d{14}\b/g
        )

        const codigoBarras = parsedText.text.match(
          /\b\d{11,13}(?:-\d)?\s+\d{11,13}(?:-\d)?\s+\d{11,13}(?:-\d)?\s+\d{11,13}(?:-\d)?\b/g
        )

        const cpfCnpjEncontrado = parsedText.text.match(
          /\b(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g
        )


        const setCpfCnpj = [...new Set(cpfCnpjEncontrado)]

        const aSerValidado = linhaDigitavel || codigoBarras

        if (!aSerValidado) {
          reply.badRequest('Codigo de Barras e Linha digitavel não encontrados')
        }

        const texto = aSerValidado![0]

        const somenteNumeros = String(texto.replace(/[^\d]/g, ''));

        const parsedBoleto = validarBoleto(somenteNumeros)

        const [idPastaProcesso, valor] = nomeArquivo.trim().replace('.pdf', '').split('-')

        const valorFormatado = valor.replace(',', '.')

        const db = await getEckermannConnection()

        const { recordset } = await db.query<{ id: string, cliente: string }[]>(`
          SELECT
            id,
            cliente,
            valor
          FROM dw_hmetrix.dbo.eckermann_tecnojuris
          WHERE pasta = '${idPastaProcesso}'
            AND valor = ${valorFormatado}
        `)

        if (recordset.length > 0) {
          await db.query(`
            UPDATE dw_hmetrix.dbo.eckermann_tecnojuris
            SET arquivoBoleto = '${url}'
            WHERE id = '${recordset[0].id}'
          `)
        }

        const {
          data: {
            usuario: { jwt_token },
          },
        } = await app.axios.post<JwtEckermannSchema>(
          'https://eyz.tecnojuris1.com.br/usuarios/sign_in.json',
          {
            usuario: {
              email: 'lmaximiano@eckermann.adv.br',
              password: 'CWRFBC',
              subdomain: 'eyz',
            },
          },
        )

        const { data } = await app.axios.post<{
            data: {
              pessoasConnection: { nodes: {
                id: string
                nome: string
                cpf: string
                cnpj: string
                bairro: string
                cep: string
                cidade: string
                endereco: string
                estado: string
                numero: string
              }[] }
            }
          }>(
            'https://eyz.tecnojuris1.com.br/graphql',
            {
              query: `
                query ($nome: String) {
                  pessoasConnection(nome: $nome) {
                    nodes {
                      id
                      nome
                      cpf
                      cnpj
                      bairro
                      cep
                      cidade
                      endereco
                      estado
                      numero
                    }
                  }
                }
              `,
              variables: { nome: recordset[0].cliente },
            },
            { headers: { AUTH_TOKEN: jwt_token } },
          )

          const { nodes } = data.data.pessoasConnection

        return reply.send({ validacaoBoleto: parsedBoleto, clienteTecnoJuris: nodes, registrosBancoDados: recordset, cpfCnpjEncontrado: setCpfCnpj })
      } catch (e: any) {
        console.log(e)

        return reply.internalServerError(e.message)
      }
    },
  )
}
