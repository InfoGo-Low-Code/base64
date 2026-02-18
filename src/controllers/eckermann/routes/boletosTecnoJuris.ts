import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { PDFParse } from 'pdf-parse'
import { Boleto, validarBoleto } from '@mrmgomes/boleto-utils'
import { getEckermannConnection } from '@/database/eckermann'
import { JwtEckermannSchema } from './eckermannTecnoJuris'
import { ocrPdfToText } from '@/utils/ocrPdfToText'
import { env } from '@/env'
import { ConnectionPool } from 'mssql'
import { FastifyInstance } from 'fastify'
import pLimit from 'p-limit'
import sql from 'mssql'
import { parseNomeArquivo } from '@/schemas/eckermann/parseNomeArquivo'
import PQueue from 'p-queue'

// NOTE: A função sleep não é mais necessária no loop de arquivos,
// pois o Promise.all lidará com a concorrência.
// const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ... (Tipos e funções auxiliares como normalizeValor, NodePessoa, RecordsetDb, infoFound, InfoFound permanecem as mesmas)

// --- Funções Auxiliares (mantidas ou extraídas para clareza) ---

function normalizeValor(valor: string) {
  valor = valor.trim()
  valor = valor.replace(/[^\d.,]/g, '')

  const decimalMatch = valor.match(/([.,])(\d{1,2})$/)

  let decimalDigits = 0

  if (decimalMatch) {
    decimalDigits = decimalMatch[2].length
  }

  // Remove todos os separadores
  valor = valor.replace(/[.,]/g, '')

  // Reinsere o ponto decimal corretamente
  if (decimalDigits > 0) {
    valor =
      valor.slice(0, -decimalDigits) +
      '.' +
      valor.slice(-decimalDigits)
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

type CNPJResponse = {
  razao_social: string
  descricao_tipo_de_logradouro: string
  logradouro: string
  numero: string
  bairro: string
  municipio: string
  uf: string
  cep: string
}

type InfoCNAB = {
  tipoInscricaoFavorecido: string
  inscricaoFavorecido: string
  nomeFavorecido: string
  enderecoFavorecido: string
  bairroFavorecido: string
  cidadeFavorecido: string
  cepFavorecido: string
  ufFavorecido: string
  dataPagamentoCNAB: string
}

const infoFound = z.object({
    nomeArquivo: z.string(),
    validacaoBoleto: z.custom<Boleto>().nullable(),
    clienteTecnoJuris: z.array(z.custom<NodePessoa>()).nullable(),
    registroBancoDados: z.array(z.custom<RecordsetDb>()).nullable(),
    cnpjEncontrado: z.string().nullable(),
    infoCNAB: z.custom<InfoCNAB>().nullable(),
})

type InfoFound = z.infer<typeof infoFound>

type FileData = {
    driveId: string,
    itemId: string,
    name: string,
    downloadUrl: string
}

const cnpjQueue = new PQueue({
  interval: 1 * 1000, // 60 segundos
  intervalCap: 1  // 3 requests
})

function formatDateCNAB(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  // console.log(date, `${yyyy}${mm}${dd}`)

  return `${yyyy}${mm}${dd}`
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

  const parsedNome = parseNomeArquivo(name)

  // console.log(parsedNome)

  if (!parsedNome) {
    return {
      nomeArquivo: name,
      validacaoBoleto: null,
      clienteTecnoJuris: [],
      registroBancoDados: [],
      cnpjEncontrado: null,
      infoCNAB: null,
    }
  }

  const { data, pasta, valor } = parsedNome

  let idPastaProcesso = pasta

  if (![data, pasta, valor].every(v => v?.trim())) {
    return {
      nomeArquivo: name,
      validacaoBoleto: null,
      clienteTecnoJuris: [],
      registroBancoDados: [],
      cnpjEncontrado: null,
      infoCNAB: null,
    }
  }

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
  const regexCnpj = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/
  const regexDataVencimento = /\d{2}\/\d{2}\/\d{4}/
  // OBS: Adaptei a regex do CPF/CNPJ para ser mais robusta, pois a sua original parecia capturar sequências muito longas de 11 ou 13 dígitos.
  
  // 2. Extração de texto
  let parsedText = await new PDFParse({ data: pdfBuffer }).getText()
  
  let linhaDigitavel = parsedText.text.match(regexLinhaDigitavel)
  let codigoBarras = parsedText.text.match(regexCodigoBarras)
  let codigoBarrasDv = parsedText.text.match(regexCodigoBarrasComDV)
  let cnpjEncontrado: string | null | RegExpMatchArray = parsedText.text.match(regexCnpj)
  let dataVencimento = parsedText.text.match(regexDataVencimento)

  let aSerValidado = linhaDigitavel || codigoBarras || codigoBarrasDv

  if (!aSerValidado) {
    // 3. Tenta OCR se não encontrou nada no PDF parse
    // console.log('Tentando OCR…')
    const textFound = await ocrPdfToText(pdfBuffer)

    linhaDigitavel = textFound.match(regexLinhaDigitavel)
    codigoBarras = textFound.match(regexCodigoBarras)
    codigoBarrasDv = textFound.match(regexCodigoBarrasComDV)
    cnpjEncontrado = textFound.match(regexCnpj)
    dataVencimento = textFound.match(regexDataVencimento)

    aSerValidado = codigoBarras || linhaDigitavel || codigoBarrasDv

    if (!aSerValidado) {
      // 4. Retorno se nada for encontrado
      // console.log('⚠ Nada encontrado no arquivo:', name)
      return {
        nomeArquivo: name,
        validacaoBoleto: null,
        clienteTecnoJuris: [],
        registroBancoDados: [],
        cnpjEncontrado: null,
        infoCNAB: null,
      }
    }
  }

  // 5. Validação do Boleto
  const texto = aSerValidado![0]
  const somenteNumeros = String(texto.replace(/[^\d]/g, ''))
  const parsedBoleto = validarBoleto(somenteNumeros)

  // 6. Extração de informações do nome do arquivo (pasta e valor)
  // const nomeLimpo = normalize(name).replace('-.PDF', '.PDF').replace('.PDF', '').trim()
  // const lastDashIndex = nomeLimpo.lastIndexOf('-')
  // let idPastaProcesso = nomeLimpo.substring(0, lastDashIndex).trim()

  // Lógica de normalização de idPastaProcesso (mantida do seu código)
  if (idPastaProcesso.includes('- R')) {
    idPastaProcesso = idPastaProcesso.replace('- R', '').trim()
  }

  if (idPastaProcesso.includes('-R')) {
    idPastaProcesso = idPastaProcesso.replace('-R', '').trim()
  }

  if (
    idPastaProcesso.includes('BRADESCO') ||
    idPastaProcesso.includes('EEP') ||
    idPastaProcesso.includes('NX') ||
    idPastaProcesso.includes('BLU') ||
    idPastaProcesso.includes('LFT') ||
    (idPastaProcesso.includes('C6') && !idPastaProcesso.includes('BUSCA'))
  ) {
    const parts = idPastaProcesso.split(/[\s-]/).filter(p => p.trim() !== '')
    if (parts.length >= 2) {
      idPastaProcesso = `${parts[0].trim()} - ${parts[1].trim()}`
    }
  }

  if (idPastaProcesso.includes('C6 BUSCA')) {
    const parts = idPastaProcesso.split('-').filter(p => p.trim() !== '')

    idPastaProcesso = `${parts[0].trim()} - ${parts[1].trim()}`
  }

  if (idPastaProcesso.includes('ITAU') ||idPastaProcesso.includes('ITAÚ')) {
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
  
  // let valorRaw = nomeLimpo.substring(lastDashIndex + 1).trim()
  let valorRaw = valor
  valorRaw = valorRaw.replace(/\(.*?\)/g, '').trim()
  const valorFormatado = normalizeValor(valorRaw)

  // 7. Consulta no Banco de Dados
  const query = `
    SELECT id, cliente, valor
    FROM dw_hmetrix.dbo.eckermann_tecnojuris
    WHERE pasta LIKE '%${idPastaProcesso}%' AND valor = ${valorFormatado}
  `

  const { recordset } = await db.query<RecordsetDb[]>(query)

  if (recordset.length === 0) {
    console.log(query, recordset)
  }

  let nodes: NodePessoa[] | null = null

  // let favorecido: Favorecido | null = null

  if (recordset.length > 0) {
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

  let infoCNAB: InfoCNAB | null = null

  if (!cnpjEncontrado) {
    cnpjEncontrado = null
    infoCNAB = null
  } else {
    cnpjEncontrado = cnpjEncontrado.toString()

    const cnpjLimpo = cnpjEncontrado.replace(/\D/g, '')
    // console.log(cnpjEncontrado, cnpjLimpo, name)
    
    const {
      razao_social,
      descricao_tipo_de_logradouro,
      logradouro,
      numero,
      bairro,
      municipio,
      cep,
      uf
    } = await cnpjQueue.add(() => buscarCnpj(app, cnpjLimpo))

    const tipoInscricaoFavorecido = "1"
    const inscricaoFavorecido = cnpjLimpo
    const nomeFavorecido = razao_social
    const enderecoFavorecido = `${descricao_tipo_de_logradouro} ${logradouro}, ${numero}`
    const bairroFavorecido = bairro
    const cidadeFavorecido = municipio
    const cepFavorecido = cep
    const ufFavorecido = uf
    const dataVencimento = new Date(parsedBoleto.vencimentoComNovoFator2025)

    let dataPagamento = new Date(dataVencimento)
    dataPagamento.setDate(dataPagamento.getDate() + 1)

    const dataPagamentoCNAB = formatDateCNAB(dataPagamento)

    infoCNAB = {
      tipoInscricaoFavorecido,
      inscricaoFavorecido,
      nomeFavorecido,
      enderecoFavorecido,
      bairroFavorecido,
      cidadeFavorecido,
      cepFavorecido,
      ufFavorecido,
      dataPagamentoCNAB,
    }
    

    if (recordset.length > 0) {
      const idRegistro = recordset[0].id

      const req = db.request()

      req.input('id', sql.VarChar(50), idRegistro)

      req.input('tipoInscricaoFavorecido', sql.Int, tipoInscricaoFavorecido)
      req.input('inscricaoFavorecido', sql.VarChar(255), inscricaoFavorecido)
      req.input('nomeFavorecido', sql.NVarChar(255), nomeFavorecido)

      req.input('enderecoFavorecido', sql.NVarChar(255), enderecoFavorecido)
      req.input('bairroFavorecido', sql.NVarChar(255), bairroFavorecido)
      req.input('cidadeFavorecido', sql.NVarChar(255), cidadeFavorecido)
      req.input('ufFavorecido', sql.NVarChar(255), ufFavorecido)
      req.input('cepFavorecido', sql.NVarChar(255), cepFavorecido.replace(/\D/g, ''))

      req.input('dataPagamento', sql.NVarChar(255), dataPagamentoCNAB)

      req.input('tipoBoleto', sql.NVarChar(255), parsedBoleto.tipoBoleto)
      req.input('linhaDigitavel', sql.NVarChar(255), parsedBoleto.linhaDigitavel)
      req.input('codigoBarras', sql.NVarChar(255), parsedBoleto.codigoBarras)

      await req.query(`
        UPDATE dw_hmetrix.dbo.eckermann_tecnojuris
        SET
          tipoInscricaoFavorecido = @tipoInscricaoFavorecido,
          inscricaoFavorecido = @inscricaoFavorecido,
          nomeFavorecido = @nomeFavorecido,
          enderecoFavorecido = @enderecoFavorecido,
          bairroFavorecido = @bairroFavorecido,
          cidadeFavorecido = @cidadeFavorecido,
          ufFavorecido = @ufFavorecido,
          cepFavorecido = @cepFavorecido,
          dataPagamento = @dataPagamento,
          tipoBoleto = @tipoBoleto,
          linhaDigitavel = @linhaDigitavel,
          codigoBarras = @codigoBarras
        WHERE id = @id
      `)
    }

    // console.log(parsedBoleto.vencimentoApos22022025, parsedBoleto.vencimento)
  }
  
  return {
    nomeArquivo: name,
    validacaoBoleto: parsedBoleto,
    clienteTecnoJuris: nodes,
    registroBancoDados: recordset,
    cnpjEncontrado,
    infoCNAB,
  }
}

const cnpjCache = new Map<string, any>()

async function buscarCnpj(app: FastifyZodTypedInstance, cnpj: string): Promise<CNPJResponse> {
  if (cnpjCache.has(cnpj)) {
    return cnpjCache.get(cnpj)
  }

  const { data } = await app.axios.get<CNPJResponse>(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)

  cnpjCache.set(cnpj, data)
  return data
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

      // const filteredFiles = files.filter(({ name }) => 
      //   !normalize(name).includes('AUTORIZACAO')
      //   && !normalize(name).includes('PIC')
      //   && !normalize(name).includes('PETICAO')
      // )

      // Se não houver arquivos, retorna rapidamente
      if (files.length === 0) {
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
        // const processingPromises = filteredFiles.map(file => 
        //   processFile(file, db, jwt_token, accessTokenGraph, app)
        // )

        // const arrayInfo: InfoFound[] = await Promise.all(processingPromises)

        // limite de concorrência — ajuste conforme necessário
        const limit = pLimit(3)

        const arrayInfo = await Promise.all(
          files.map(file =>
            limit(() =>
              processFile(file, db, jwt_token, accessTokenGraph, app)
            )
          )
        )

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