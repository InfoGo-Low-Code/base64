import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { PDFParse } from 'pdf-parse'
import { Boleto, validarBoleto } from '@mrmgomes/boleto-utils'
import { getEckermannConnection } from '@/database/eckermann'
import { JwtEckermannSchema } from './eckermannTecnoJuris'
import { ocrPdfToText } from '@/utils/eckermann/ocrPdfToText'

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
  validacaoBoleto: z.custom<Boleto>().nullable(),
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
        await Promise.all(
          files.map(async ({ url, nomeArquivo }) => {
            const parser = new PDFParse({ url })
            const parsedText = await parser.getText()

            const regexLinhaDigitavel = new RegExp(
              /\b\d{5}[.\s]?\d{5}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d[.\s]?\d{14}\b/g
            )
            const regexCodigoBarras = new RegExp(
              /\b\d{11,13}(?:-\d)?\s+\d{11,13}(?:-\d)?\s+\d{11,13}(?:-\d)?\s+\d{11,13}(?:-\d)?\b/g
            )
            const regexCpfCnpj = new RegExp(
              /\b(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g
            )
    
            const linhaDigitavel = parsedText.text.match(regexLinhaDigitavel)
    
            const codigoBarras = parsedText.text.match(regexCodigoBarras)
    
            const cpfCnpjEncontrado = parsedText.text.match(regexCpfCnpj)
    
            let setCpfCnpj = [...new Set(cpfCnpjEncontrado)]
    
            let aSerValidado = linhaDigitavel || codigoBarras
    
            if (!aSerValidado) {
              const textFound = await ocrPdfToText(url)
              
              const linhaDigitavelOcr = textFound.match(
                regexLinhaDigitavel
              )

              const codigoBarrasOcr = textFound.match(
                regexCodigoBarras
              )

              const cpfCnpjEncontradoOcr = textFound.match(
                regexCpfCnpj
              )

              setCpfCnpj = [...new Set(cpfCnpjEncontradoOcr)]

              aSerValidado = codigoBarrasOcr || linhaDigitavelOcr

              if (!aSerValidado) {
                arrayInfo.push({
                  validacaoBoleto: null,
                  clienteTecnoJuris: [],
                  registroBancoDados: [],
                  cpfCnpjEncontrado: [],
                })
              }
            }
    
            const texto = aSerValidado![0]
    
            const somenteNumeros = String(texto.replace(/[^\d]/g, ''))
    
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
        )

        return reply.send({ infoBoletos: arrayInfo })
      } catch (e: any) {
        console.log(e)

        return reply.internalServerError(e.message)
      }
    },
  )
}
