import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { PDFParse } from 'pdf-parse'
import { Boleto, validarBoleto } from '@mrmgomes/boleto-utils'
import { getEckermannConnection } from '@/database/eckermann'
import { JwtEckermannSchema } from './eckermannTecnoJuris'

type NodePessoa = {
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
}

type RecordsetDb = {
  id: string,
  cliente: string
}

const infoFound = z.object({
  validacaoBoleto: z.custom<Boleto>(),
  clienteTecnoJuris: z.array(z.custom<NodePessoa>()),
  registroBancoDados: z.array(z.custom<RecordsetDb>()),
  cpfCnpjEncontrado: z.array(z.string()),
})

type InfoFound = z.infer<typeof infoFound>

export function boletosTecnoJuris(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/boletosTecnoJuris',
    {
      schema: {
        body: z.object({
          files: z.array(
            z.object({
              url: z.string().url(),
              nomeArquivo: z.string(),
            })  
          )
        }),
        response: {
          200: z.object({
            infoBoletos: z.array(infoFound)
          })
        }
      }
    },
    async (request, reply) => {
      const { files } = request.body

      const arrayInfo: InfoFound[] = []

      try {
        files.forEach(async ({ url, nomeArquivo }) => {
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
  
          const { recordset } = await db.query<RecordsetDb[]>(`
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
                pessoasConnection: {
                    nodes: NodePessoa[]
                }
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

            arrayInfo.push({
              validacaoBoleto: parsedBoleto,
              clienteTecnoJuris: nodes,
              registroBancoDados: recordset,
              cpfCnpjEncontrado: setCpfCnpj,
            })
        })
        return reply.send({ infoBoletos: arrayInfo })
      } catch (e: any) {
        console.log(e)

        return reply.internalServerError(e.message)
      }
    },
  )
}
