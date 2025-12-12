// import { z } from 'zod'
// import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
// import { PDFParse } from 'pdf-parse'
// import { Boleto, validarBoleto } from '@mrmgomes/boleto-utils'
// import { getEckermannConnection } from '@/database/eckermann'
// import { JwtEckermannSchema } from './eckermannTecnoJuris'
// import { ocrPdfToText } from '@/utils/eckermann/ocrPdfToText'
// import { normalize } from '@/utils/normalize'
// import { env } from '@/env'

// const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// function normalizeValor(valor: string) {
//   valor = valor.trim()

//   // Remove tudo que não seja dígito, ponto ou vírgula
//   valor = valor.replace(/[^\d.,]/g, '')

//   // Detecta separador decimal: vírgula ou ponto
//   const decimalMatch = valor.match(/([.,])(\d{2})$/)

//   let decimalSeparator = null

//   if (decimalMatch) {
//     decimalSeparator = decimalMatch[1] // "." ou ","
//   }

//   // Remove todos os pontos e vírgulas
//   valor = valor.replace(/[.,]/g, '')

//   // Se tinha separador decimal real, recoloca ele antes dos últimos 2 dígitos
//   if (decimalSeparator) {
//     valor = valor.slice(0, -2) + '.' + valor.slice(-2)
//   }

//   return valor
// }

// type NodePessoa = {
//   id: string
//   nome: string
//   cpf: string
//   cnpj: string
//   bairro: string
//   cep: string
//   cidade: string
//   endereco: string
//   estado: string
//   numero: string
// }

// type RecordsetDb = {
//   id: string,
//   cliente: string
// }

// const infoFound = z.object({
//   nomeArquivo: z.string(),
//   validacaoBoleto: z.custom<Boleto>().nullable(),
//   clienteTecnoJuris: z.array(z.custom<NodePessoa>()).nullable(),
//   registroBancoDados: z.array(z.custom<RecordsetDb>()).nullable(),
//   cpfCnpjEncontrado: z.array(z.string()),
// })

// type InfoFound = z.infer<typeof infoFound>

// export function boletosTecnoJuris(app: FastifyZodTypedInstance) {
//   app.post(
//     '/eckermann/boletosTecnoJuris',
//     {
//       schema: {
//         body: z.object({
//           files: z.array(
//             z.object({
//               driveId: z.string(),
//               itemId: z.string(),
//               name: z.string(),
//               downloadUrl: z.string()
//             })  
//           )
//         }),
//         response: {
//           200: z.object({
//             infoBoletos: z.array(infoFound)
//           })
//         }
//       }
//     },
//     async (request, reply) => {
//       const { files } = request.body

//       const filteredFiles = files.filter(({ name }) => 
//         !normalize(name).includes('AUTORIZACAO')
//         && !normalize(name).includes('PIC')
//         && !normalize(name).includes('PETICAO')
//       )

//       const arrayInfo: InfoFound[] = []

//       const db = await getEckermannConnection()

//       const {
//         data: {
//           usuario: { jwt_token },
//         },
//       } = await app.axios.post<JwtEckermannSchema>(
//         'https://eyz.tecnojuris1.com.br/usuarios/sign_in.json',
//         {
//           usuario: {
//             email: 'lmaximiano@eckermann.adv.br',
//             password: 'CWRFBC',
//             subdomain: 'eyz',
//           },
//         },
//       )

//       const { CLIENT_ID_AZURE, CLIENT_SECRET_AZURE, TENANT_ID_AZURE } = env

//       const { data: { access_token: accessTokenGraph }} = await app.axios.post(
//         `https://login.microsoftonline.com/${TENANT_ID_AZURE}/oauth2/v2.0/token`,
//         new URLSearchParams({
//           client_id: CLIENT_ID_AZURE,
//           client_secret: CLIENT_SECRET_AZURE,
//           scope: "https://graph.microsoft.com/.default",
//           grant_type: "client_credentials"
//         })
//       )

//       try {
//         for (const [idx, { driveId, itemId, name, downloadUrl }] of filteredFiles.entries()) {
//           // console.log('PROCESSANDO:', name, idx)

//           const { data: pdfBuffer } = await app.axios.get(
//             downloadUrl,
//             {
//               responseType: "arraybuffer",
//               headers: {
//                 Authorization: `Bearer ${accessTokenGraph}`
//               }
//             }
//           )

//           const parsedText = await new PDFParse({ data: pdfBuffer }).getText()

//           const regexLinhaDigitavel = /\b\d{5}[.\s]?\d{5}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d[.\s]?\d{14}\b/g
//           const regexCodigoBarras = /\b\d{10,12}\s?\d\s?\d{10,12}\s?\d\s?\d{10,12}\s?\d\s?\d{10,12}\s?\d\b/g
//           const regexCodigoBarrasComDV = /\b\d{11}-\d(?:\s+\d{11}-\d){3}\b/g
//           const regexCpfCnpj = /\b\d{11,13}\s?\d{11,13}\s?\d{11,13}\s?\d{11,13}\b/g

//           const linhaDigitavel = parsedText.text.match(regexLinhaDigitavel)
//           const codigoBarras = parsedText.text.match(regexCodigoBarras)
//           const codigoBarrasDv = parsedText.text.match(regexCodigoBarrasComDV)
//           const cpfCnpjEncontrado = parsedText.text.match(regexCpfCnpj)

//           let setCpfCnpj = [...new Set(cpfCnpjEncontrado)]
//           let aSerValidado = linhaDigitavel || codigoBarras || codigoBarrasDv

//           // 👉 Logs para ver onde quebra
//           // console.log('Linha digitável:', linhaDigitavel)
//           // console.log('Código de barras:', codigoBarras)
//           // console.log('CPF/CNPJ:', setCpfCnpj)

//           if (!aSerValidado) {
//             // console.log('Tentando OCR…')

//             const textFound = await ocrPdfToText(pdfBuffer)

//             const linhaDigitavelOcr = textFound.match(regexLinhaDigitavel)
//             const codigoBarrasOcr = textFound.match(regexCodigoBarras)
//             const codigoBarrasDvOrc = textFound.match(regexCodigoBarrasComDV)
//             const cpfCnpjEncontradoOcr = textFound.match(regexCpfCnpj)

//             setCpfCnpj = [...new Set(cpfCnpjEncontradoOcr)]
//             aSerValidado = codigoBarrasOcr || linhaDigitavelOcr || codigoBarrasDvOrc

//             // console.log('OCR - Linha digitável:', linhaDigitavelOcr)
//             // console.log('OCR - Código de barras:', codigoBarrasOcr)
//             // console.log('OCR - CPF/CNPJ:', setCpfCnpj)

//             if (!aSerValidado) {
//               arrayInfo.push({
//                 nomeArquivo: name,
//                 validacaoBoleto: null,
//                 clienteTecnoJuris: [],
//                 registroBancoDados: [],
//                 cpfCnpjEncontrado: [],
//               })

//               // console.log('⚠ Nada encontrado no arquivo:', name)
//               continue
//             }
//           }

//           const texto = aSerValidado![0]
//           const somenteNumeros = String(texto.replace(/[^\d]/g, ''))
//           const parsedBoleto = validarBoleto(somenteNumeros)

//           const nomeLimpo = normalize(name).replace('-.PDF', '.PDF').replace('.PDF', '').trim()
//           const lastDashIndex = nomeLimpo.lastIndexOf('-')
//           let idPastaProcesso = nomeLimpo.substring(0, lastDashIndex).trim()

//           if (idPastaProcesso.includes('- R')) {
//             idPastaProcesso = idPastaProcesso.replace('- R', '').trim()

//             // console.log(idPastaProcesso)
//           }

//           if (idPastaProcesso.includes('BRADESCO') || idPastaProcesso.includes('EEP') || idPastaProcesso.includes('NX')) {
//             if (idPastaProcesso.includes('-')) {
//               const [sigla, numero] = idPastaProcesso.split('-')

//               idPastaProcesso = `${sigla.trim()} - ${numero.trim()}`
//             } else {
//               const [sigla, numero] = idPastaProcesso.split(' ')

//               idPastaProcesso = `${sigla.trim()} - ${numero.trim()}`
//             }

//             // console.log(idPastaProcesso)
//           }

//           if (idPastaProcesso.includes('ITAU')) {
//             if (idPastaProcesso.includes('-')) {
//               const [_, numero] = idPastaProcesso.split('-')

//               idPastaProcesso = `ITAÚ - ${numero.trim()}`
//             } else {
//               const [_, numero] = idPastaProcesso.split(' ')

//               idPastaProcesso = `ITAÚ - ${numero.trim()}`
//             }
//           }

//           if (idPastaProcesso.includes('AT')) {
//             const [siglaAT, numero] = idPastaProcesso.split('-')
//             idPastaProcesso = `${siglaAT.trim()} - ${numero.trim()}`

//             // console.log(idPastaProcesso)
//           }

//           if (idPastaProcesso.includes('VISIO')) {
//             const [siglaAT, numero] = idPastaProcesso.split('-')
//             idPastaProcesso = `${siglaAT.trim()}  - ${numero.trim()}`

//             // console.log(idPastaProcesso)
//           }

//           let valorRaw = nomeLimpo.substring(lastDashIndex + 1).trim()
//           valorRaw = valorRaw.replace(/\(.*?\)/g, '').trim()
//           const valorFormatado = normalizeValor(valorRaw)

//           // console.log({nomeLimpo, idPastaProcesso, valorRaw, valorFormatado}, name)

//           const query = `
//             SELECT id, cliente, valor
//             FROM dw_hmetrix.dbo.eckermann_tecnojuris
//             WHERE pasta = '${idPastaProcesso}' AND valor = ${valorFormatado}
//           `

//           const { recordset } = await db.query<RecordsetDb[]>(query)

//           if (recordset.length === 0) {
//             console.log(query, recordset)
//           }


//           let nodes: NodePessoa[] | null = null

//           if (recordset.length > 0) {
//             await db.query(`
//               UPDATE dw_hmetrix.dbo.eckermann_tecnojuris
//               SET arquivoBoleto = 'graph://${driveId}/${itemId}'
//               WHERE id = '${recordset[0].id}'
//             `)

//             const { data } = await app.axios.post<{
//               data: {
//                 pessoasConnection: {
//                   nodes: NodePessoa[]
//                 }
//               }
//             }>(
//               'https://eyz.tecnojuris1.com.br/graphql',
//               {
//                 query: `
//                   query ($nome: String) {
//                     pessoasConnection(nome: $nome) {
//                       nodes {
//                         id
//                         nome
//                         cpf
//                         cnpj
//                         bairro
//                         cep
//                         cidade
//                         endereco
//                         estado
//                         numero
//                       }
//                     }
//                   }
//                 `,
//                 variables: { nome: recordset[0]?.cliente },
//               },
//               { headers: { AUTH_TOKEN: jwt_token } },
//             )

//             nodes = data.data.pessoasConnection.nodes || null
//           }

//           arrayInfo.push({
//             nomeArquivo: name,
//             validacaoBoleto: parsedBoleto,
//             clienteTecnoJuris: nodes,
//             registroBancoDados: recordset,
//             cpfCnpjEncontrado: setCpfCnpj,
//           })

//           // console.log('✔ Finalizado arquivo:', name)

//           await sleep(1500)
//         }

//         console.log(arrayInfo)

//         return reply.send({ infoBoletos: arrayInfo })
//       } catch (e: any) {
//         console.log(e)

//         return reply.internalServerError(e.message)
//       }
//     },
//   )
// }

import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { PDFParse } from 'pdf-parse'
import { Boleto, validarBoleto } from '@mrmgomes/boleto-utils'
import { getEckermannConnection } from '@/database/eckermann'
import { JwtEckermannSchema } from './eckermannTecnoJuris'
import { ocrPdfToText } from '@/utils/eckermann/ocrPdfToText'
import { normalize } from '@/utils/normalize'
import { env } from '@/env'
import { ConnectionPool } from 'mssql'
import { FastifyInstance } from 'fastify'

// NOTE: A função sleep não é mais necessária no loop de arquivos,
// pois o Promise.all lidará com a concorrência.
// const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ... (Tipos e funções auxiliares como normalizeValor, NodePessoa, RecordsetDb, infoFound, InfoFound permanecem as mesmas)

// --- Funções Auxiliares (mantidas ou extraídas para clareza) ---

function normalizeValor(valor: string) {
  valor = valor.trim()
  valor = valor.replace(/[^\d.,]/g, '')
  const decimalMatch = valor.match(/([.,])(\d{2})$/)
  let decimalSeparator = null

  if (decimalMatch) {
    decimalSeparator = decimalMatch[1]
  }

  valor = valor.replace(/[.,]/g, '')

  if (decimalSeparator) {
    valor = valor.slice(0, -2) + '.' + valor.slice(-2)
  }

  return valor
}

// Tipos definidos no seu código original
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
    nomeArquivo: z.string(),
    validacaoBoleto: z.custom<Boleto>().nullable(),
    clienteTecnoJuris: z.array(z.custom<NodePessoa>()).nullable(),
    registroBancoDados: z.array(z.custom<RecordsetDb>()).nullable(),
    cpfCnpjEncontrado: z.array(z.string()),
})

type InfoFound = z.infer<typeof infoFound>

type FileData = {
    driveId: string,
    itemId: string,
    name: string,
    downloadUrl: string
}

// --- Nova Função para Processamento de Arquivo Único (Paralelizável) ---

/**
 * Processa um único arquivo de boleto.
 * @param file Dados do arquivo (driveId, itemId, name, downloadUrl).
 * @param db Conexão com o banco de dados.
 * @param jwt_token Token JWT para a TecnoJuris.
 * @param accessTokenGraph Token de acesso para o Microsoft Graph.
 * @param app Instância do Fastify/Axios para requisições.
 * @returns Uma Promise que resolve para o objeto InfoFound.
 */
async function processFile(
  file: FileData, 
  db: ConnectionPool, 
  jwt_token: string, 
  accessTokenGraph: string,
  app: FastifyInstance // Usamos FastifyInstance para tipar corretamente o app.axios
): Promise<InfoFound> {
  const { driveId, itemId, name, downloadUrl } = file

  // console.log('PROCESSANDO:', name)

  // 1. Download do PDF
  const { data: pdfBuffer } = await app.axios.get(
    downloadUrl,
    {
      responseType: "arraybuffer",
      headers: {
        Authorization: `Bearer ${accessTokenGraph}`
      }
    }
  )

  // Regexes para validação e extração (mantidas do seu código)
  const regexLinhaDigitavel = /\b\d{5}[.\s]?\d{5}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d[.\s]?\d{14}\b/g
  const regexCodigoBarras = /\b\d{10,12}\s?\d\s?\d{10,12}\s?\d\s?\d{10,12}\s?\d\s?\d{10,12}\s?\d\b/g
  const regexCodigoBarrasComDV = /\b\d{11}-\d(?:\s+\d{11}-\d){3}\b/g
  const regexCpfCnpj = /\b(?:\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}|\d{2}[.\s]?\d{3}[.\s]?\d{3}[/.\s]?\d{4}[-.\s]?\d{2})\b/g
  // OBS: Adaptei a regex do CPF/CNPJ para ser mais robusta, pois a sua original parecia capturar sequências muito longas de 11 ou 13 dígitos.
  
  // 2. Extração de texto
  let parsedText = await new PDFParse({ data: pdfBuffer }).getText()
  
  let linhaDigitavel = parsedText.text.match(regexLinhaDigitavel)
  let codigoBarras = parsedText.text.match(regexCodigoBarras)
  let codigoBarrasDv = parsedText.text.match(regexCodigoBarrasComDV)
  let cpfCnpjEncontrado = parsedText.text.match(regexCpfCnpj)

  let setCpfCnpj = [...new Set(cpfCnpjEncontrado || [])]
  let aSerValidado = linhaDigitavel || codigoBarras || codigoBarrasDv

  if (!aSerValidado) {
    // 3. Tenta OCR se não encontrou nada no PDF parse
    // console.log('Tentando OCR…')
    const textFound = await ocrPdfToText(pdfBuffer)

    linhaDigitavel = textFound.match(regexLinhaDigitavel)
    codigoBarras = textFound.match(regexCodigoBarras)
    codigoBarrasDv = textFound.match(regexCodigoBarrasComDV)
    cpfCnpjEncontrado = textFound.match(regexCpfCnpj)

    setCpfCnpj = [...new Set(cpfCnpjEncontrado || [])]
    aSerValidado = codigoBarras || linhaDigitavel || codigoBarrasDv

    if (!aSerValidado) {
      // 4. Retorno se nada for encontrado
      // console.log('⚠ Nada encontrado no arquivo:', name)
      return {
        nomeArquivo: name,
        validacaoBoleto: null,
        clienteTecnoJuris: [],
        registroBancoDados: [],
        cpfCnpjEncontrado: [],
      }
    }
  }

  // 5. Validação do Boleto
  const texto = aSerValidado![0]
  const somenteNumeros = String(texto.replace(/[^\d]/g, ''))
  const parsedBoleto = validarBoleto(somenteNumeros)

  // 6. Extração de informações do nome do arquivo (pasta e valor)
  const nomeLimpo = normalize(name).replace('-.PDF', '.PDF').replace('.PDF', '').trim()
  const lastDashIndex = nomeLimpo.lastIndexOf('-')
  let idPastaProcesso = nomeLimpo.substring(0, lastDashIndex).trim()

  // Lógica de normalização de idPastaProcesso (mantida do seu código)
  if (idPastaProcesso.includes('- R')) {
    idPastaProcesso = idPastaProcesso.replace('- R', '').trim()
  }

  if (idPastaProcesso.includes('BRADESCO') || idPastaProcesso.includes('EEP') || idPastaProcesso.includes('NX')) {
    const parts = idPastaProcesso.split(/[\s-]/).filter(p => p.trim() !== '')
    if (parts.length >= 2) {
      idPastaProcesso = `${parts[0].trim()} - ${parts[1].trim()}`
    }
  }

  if (idPastaProcesso.includes('ITAU')) {
    const parts = idPastaProcesso.split(/[\s-]/).filter(p => p.trim() !== '')
    if (parts.length >= 2) {
      idPastaProcesso = `ITAÚ - ${parts[1].trim()}`
    }
  }

  if (idPastaProcesso.includes('AT') && idPastaProcesso.includes('-')) {
    const [siglaAT, numero] = idPastaProcesso.split('-')
    idPastaProcesso = `${siglaAT.trim()} - ${numero.trim()}`
  }

  if (idPastaProcesso.includes('VISIO') && idPastaProcesso.includes('-')) {
    const [siglaAT, numero] = idPastaProcesso.split('-')
    idPastaProcesso = `${siglaAT.trim()}  - ${numero.trim()}`
  }
  
  let valorRaw = nomeLimpo.substring(lastDashIndex + 1).trim()
  valorRaw = valorRaw.replace(/\(.*?\)/g, '').trim()
  const valorFormatado = normalizeValor(valorRaw)

  // 7. Consulta no Banco de Dados
  const query = `
    SELECT id, cliente, valor
    FROM dw_hmetrix.dbo.eckermann_tecnojuris
    WHERE pasta = '${idPastaProcesso}' AND valor = ${valorFormatado}
  `

  const { recordset } = await db.query<RecordsetDb[]>(query)

  if (recordset.length === 0) {
    // console.log(query, recordset)
  }

  let nodes: NodePessoa[] | null = null

  if (recordset.length > 0) {
    // 8. Update no Banco de Dados
    await db.query(`
      UPDATE dw_hmetrix.dbo.eckermann_tecnojuris
      SET arquivoBoleto = 'graph://${driveId}/${itemId}'
      WHERE id = '${recordset[0].id}'
    `)

    // 9. Consulta GraphQL
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
        variables: { nome: recordset[0]?.cliente },
      },
      { headers: { AUTH_TOKEN: jwt_token } },
    )

    nodes = data.data.pessoasConnection.nodes || null
  }

  // console.log('✔ Finalizado arquivo:', name)
  
  return {
    nomeArquivo: name,
    validacaoBoleto: parsedBoleto,
    clienteTecnoJuris: nodes,
    registroBancoDados: recordset,
    cpfCnpjEncontrado: setCpfCnpj,
  }
}

// --- Função Principal (Refatorada) ---

export function boletosTecnoJuris(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/boletosTecnoJuris',
    {
      schema: {
        // ... (Schema inalterado)
        body: z.object({
          files: z.array(
            z.object({
              driveId: z.string(),
              itemId: z.string(),
              name: z.string(),
              downloadUrl: z.string()
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

      const filteredFiles = files.filter(({ name }) => 
        !normalize(name).includes('AUTORIZACAO')
        && !normalize(name).includes('PIC')
        && !normalize(name).includes('PETICAO')
      )

      // Se não houver arquivos, retorna rapidamente
      if (filteredFiles.length === 0) {
        return reply.send({ infoBoletos: [] })
      }

      // Conexões e Tokens (Operações Sequenciais Iniciais)
      // Estas devem ser sequenciais, pois são dependentes (precisa do token TecnoJuris para o GraphQL, e do DB para as queries)
      const dbPromise = getEckermannConnection()
      
      const tecnoJurisLoginPromise = app.axios.post<JwtEckermannSchema>(
        'https://eyz.tecnojuris1.com.br/usuarios/sign_in.json',
        {
          usuario: {
            email: 'lmaximiano@eckermann.adv.br',
            password: 'CWRFBC',
            subdomain: 'eyz',
          },
        },
      )
      
      const { CLIENT_ID_AZURE, CLIENT_SECRET_AZURE, TENANT_ID_AZURE } = env
      
      const graphTokenPromise = app.axios.post(
        `https://login.microsoftonline.com/${TENANT_ID_AZURE}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: CLIENT_ID_AZURE,
          client_secret: CLIENT_SECRET_AZURE,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials"
        })
      )
      
      // Resolve as dependências iniciais em paralelo (ou quase)
      const [db, tecnoJurisLogin, graphTokenResponse] = await Promise.all([
          dbPromise, 
          tecnoJurisLoginPromise, 
          graphTokenPromise
      ])
      
      const jwt_token = tecnoJurisLogin.data.usuario.jwt_token
      const accessTokenGraph = graphTokenResponse.data.access_token

      try {
        // 🚨 OTIMIZAÇÃO PRINCIPAL: Processamento em Paralelo com Promise.all
        const processingPromises = filteredFiles.map(file => 
          processFile(file, db, jwt_token, accessTokenGraph, app)
        )

        // Resolve todas as promessas de processamento de arquivos
        const arrayInfo: InfoFound[] = await Promise.all(processingPromises)

        // console.log(arrayInfo)

        return reply.send({ infoBoletos: arrayInfo })
      } catch (e: any) {
        console.error(e) // Use console.error para logs de erro
        
        // Garante que a conexão do banco seja fechada ou liberada
        // A ConnectionPool gerencia as conexões, então podemos deixar o Fastify/ambiente cuidar disso,
        // mas em um cenário mais rigoroso, a pool pode precisar ser liberada.
        
        return reply.internalServerError(e.message)
      }
    },
  )
}