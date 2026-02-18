import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { PDFParse } from 'pdf-parse'
import { validarBoleto, Boleto } from '@mrmgomes/boleto-utils'
import { ocrPdfToText } from '@/utils/ocrPdfToText'
import pLimit from 'p-limit'
import { FastifyInstance } from 'fastify'
import { getEckermannConnection } from '@/database/eckermann'
import sql, { ConnectionPool } from 'mssql'
import { parseNomeArquivo } from '@/schemas/eckermann/parseNomeArquivo'
import { proximoDiaUtil } from '@/utils/eckermann/proximoDiaUtil'
import { buscarCnpj, CNPJResponse } from '@/utils/eckermann/buscarCnpj'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// =======================
// Schemas
// =======================

const infoFound = z.object({
  nomeArquivo: z.string(),
  boleto: z.custom<Boleto>().nullable(),
  dataPagamento: z.string().nullable(),
  nomeBeneficiario: z.string().nullable(),
  inscricaoBeneficiario: z.string().nullable(),
}).optional()

type InfoFound = z.infer<typeof infoFound>

type FileData = {
  driveId: string
  itemId: string
  name: string
  downloadUrl: string
}

const inscricaoCache = new Map<string, CNPJResponse>()

async function buscarInscricao(
  app: FastifyZodTypedInstance,
  inscricao: string,
  db: ConnectionPool
): Promise<{
  nomeBeneficiario: string
  inscricaoBeneficiario: string
}> {
  let nomeBeneficiario = ''
  let inscricaoBeneficiario = ''

  const regexCNPJ = /^\d{14}$/

  if (regexCNPJ.test(inscricao)) {
    const responseCnpj = await buscarCnpj(app, db, inscricao, inscricaoCache)

    nomeBeneficiario = responseCnpj.razao_social
    inscricaoBeneficiario = responseCnpj.cnpj

    return { nomeBeneficiario, inscricaoBeneficiario }
  } else {
    console.log(`Tem (;): ${inscricao}`)

    const beneficiario = inscricao.split(';')

    nomeBeneficiario = beneficiario[0].toUpperCase().trim()
    inscricaoBeneficiario = beneficiario[1].toUpperCase().trim()

    return { nomeBeneficiario, inscricaoBeneficiario }
  }
}

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

type RecordsetDb = {
    id: string
    cliente: string
    pasta: string
    valor: number
    data: Date
}

// =======================
// Processamento do arquivo
// =======================

async function processFile(
  file: FileData,
  accessTokenGraph: string,
  app: FastifyInstance,
  db: ConnectionPool,
): Promise<InfoFound> {
  const { name, downloadUrl } = file
  
    const parsedNome = parseNomeArquivo(name)
  
    // console.log(parsedNome)
  
    if (!parsedNome) {
      return {
        nomeArquivo: name,
        boleto: null,
        dataPagamento: null,
        nomeBeneficiario: null,
        inscricaoBeneficiario: null,
      }
    }
  
    const { data, pasta, valor } = parsedNome
  
    let idPastaProcesso = pasta
  
    if (![data, pasta, valor].every(v => v?.trim())) {
      return {
        nomeArquivo: name,
        boleto: null,
        dataPagamento: null,
        nomeBeneficiario: null,
        inscricaoBeneficiario: null,
      }
    }
  
    // console.log('PROCESSANDO:', name)

    try {
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

      const inscricaoArray = Array.from(inscricaoCache, ([key, value]) => ({
        cnpj: key,
        pagador: value.razao_social,
      }))

      const { data: dataFile } = await app.axios.post<{
        Result: {
          text: string
        }
      }>(
        'https://my-space-v-wco.api.integrasky.cloud/weCR3B7Wvd',
        {
          PDF: downloadUrl,
          Nome_Arquivo: name,
          Pagadores: inscricaoArray
        },
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )

      let llmResponse = dataFile.Result.text

      console.warn({ llmResponse, name })

      let nomeBeneficiario = null
      let inscricaoBeneficiario = null

      const regexCNPJ = /^\d{14}$/

      let beneficiario = {
        nomeBeneficiario: '',
        inscricaoBeneficiario: ''
      }

      let orgao = ''

      if (regexCNPJ.test(llmResponse) || llmResponse.includes(';')) {
        beneficiario = await buscarInscricao(app, llmResponse, db)
      } else {
        orgao = llmResponse
      }

      // console.log({ beneficiario, name })

      nomeBeneficiario = beneficiario.nomeBeneficiario
      inscricaoBeneficiario = beneficiario.inscricaoBeneficiario

      await sleep(7000)

      // Regexes para validação e extração (mantidas do seu código)
      const regexLinhaDigitavel = /\b\d{5}[.\s]?\d{5}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d[.\s]?\d{14}\b/g
      const regexCodigoBarras = /\b\d{10,12}\s?\d\s?\d{10,12}\s?\d\s?\d{10,12}\s?\d\s?\d{10,12}\s?\d\b/g
      const regexCodigoBarrasComDV = /\b\d{11}-\d(?:\s+\d{11}-\d){3}\b/g
      
      // 2. Extração de texto
      let parsedText = await new PDFParse({ data: pdfBuffer }).getText()
      
      let linhaDigitavel = parsedText.text.match(regexLinhaDigitavel)
      let codigoBarras = parsedText.text.match(regexCodigoBarras)
      let codigoBarrasDv = parsedText.text.match(regexCodigoBarrasComDV)
    
      let aSerValidado = linhaDigitavel || codigoBarras || codigoBarrasDv
    
      if (!aSerValidado) {
        // 3. Tenta OCR se não encontrou nada no PDF parse
        // console.log('Tentando OCR…')
        const textFound = await ocrPdfToText(pdfBuffer)
    
        linhaDigitavel = textFound.match(regexLinhaDigitavel)
        codigoBarras = textFound.match(regexCodigoBarras)
        codigoBarrasDv = textFound.match(regexCodigoBarrasComDV)
    
        aSerValidado = codigoBarras || linhaDigitavel || codigoBarrasDv
    
        if (!aSerValidado) {
          // 4. Retorno se nada for encontrado
          // console.log('⚠ Nada encontrado no arquivo:', name)
          return {
            nomeArquivo: name,
            boleto: null,
            dataPagamento: null,
            nomeBeneficiario,
            inscricaoBeneficiario,
          }
        }
      }
    
      // 5. Validação do Boleto
      const texto = aSerValidado![0]
      const somenteNumeros = String(texto.replace(/[^\d]/g, ''))
      const parsedBoleto = validarBoleto(somenteNumeros)

      let valorCnab: number | string = ''

      // valorCnab = parsedBoleto.valor
    
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

      if (idPastaProcesso.includes('AT') && !idPastaProcesso.includes('-')) {
        const [siglaAT, numero] = idPastaProcesso.split(' ')
        idPastaProcesso = `${siglaAT.trim()} - ${numero.trim()}`
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

      if (name.includes('NX 1114071')) idPastaProcesso = 'NX - 1114701'
      
      // 7. Consulta no Banco de Dados
      const query = `
        SELECT
          id,
          cliente,
          valor,
          pasta,
          data
        FROM dw_hmetrix.dbo.eckermann_tecnojuris
        WHERE pasta LIKE '%${idPastaProcesso}%' AND valor = ${valorFormatado}
      `

      const { recordset } = await db.query<RecordsetDb[]>(query)
    
      if (recordset.length === 0) {
        console.log(query)
      }

      if (recordset.length > 0) {
        const dataPagamento = proximoDiaUtil(recordset[0].data.toISOString())

        // console.log(dataPagamento, recordset[0].data, new Date(recordset[0].data))

        // console.log(inscricaoBeneficiario)
        await db
          .request()
          .input('id', sql.NVarChar(255), recordset[0].id)
          .input('codigoBarras', sql.NVarChar(255), parsedBoleto.codigoBarras)
          .input('linhaDigitavel', sql.NVarChar(255), parsedBoleto.linhaDigitavel)
          .input('dataPagamento', sql.Date, new Date(dataPagamento))
          .input('nomeBeneficiario', sql.NVarChar(255), nomeBeneficiario)
          .input('inscricaoBeneficiario', sql.NVarChar(255), inscricaoBeneficiario)
          .input('dataVencimentoBoleto', sql.Date, new Date(parsedBoleto.vencimentoComNovoFator2025))
          .input('orgao', sql.NVarChar(255), orgao)
          .query(`
            UPDATE dbo.eckermann_tecnojuris
            SET
              codigoBarras = @codigoBarras,
              linhaDigitavel = @linhaDigitavel,
              dataPagamento = @dataPagamento,
              statusPagamento = 'PENDENTE',
              nomeBeneficiario = @nomeBeneficiario,
              dataVencimentoBoleto = @dataVencimentoBoleto,
              inscricaoBeneficiario = @inscricaoBeneficiario,
              orgao = @orgao
            WHERE id = @id
          `)
        
        return {
          nomeArquivo: name,
          boleto: parsedBoleto,
          dataPagamento: dataPagamento.toISOString().substring(0, 10),
          nomeBeneficiario,
          inscricaoBeneficiario,
        }
      }

      return {
        nomeArquivo: name,
        boleto: parsedBoleto,
        dataPagamento: null,
        nomeBeneficiario,
        inscricaoBeneficiario,
      }
    } catch (error) {
      console.log(`Erro de Arquivo: ${name}`)
      console.log(error)
    }
}

// =======================
// Rota principal
// =======================

export function boletosTecnoJurisCnab(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/boletosTecnoJurisCnab',
    {
      schema: {
        body: z.object({
          files: z.array(
            z.object({
              driveId: z.string(),
              itemId: z.string(),
              name: z.string(),
              downloadUrl: z.string(),
            })
          ),
        }),
        response: {
          200: z.object({
            infoBoletos: z.array(infoFound),
          }),
        },
      },
    },
    async (request, reply) => {
      const { files } = request.body

      if (!files.length) {
        return reply.send({ infoBoletos: [] })
      }

      const { CLIENT_ID_AZURE, CLIENT_SECRET_AZURE, TENANT_ID_AZURE } = process.env

      const tokenResponse = await app.axios.post(
        `https://login.microsoftonline.com/${TENANT_ID_AZURE}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: CLIENT_ID_AZURE!,
          client_secret: CLIENT_SECRET_AZURE!,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        })
      )

      const accessTokenGraph = tokenResponse.data.access_token

      const limit = pLimit(1)

      const db = await getEckermannConnection()

      const infoBoletos = await Promise.all(
        files.map(file =>
          limit(() => processFile(file, accessTokenGraph, app, db))
        )
      )

      return reply.send({ infoBoletos })
    }
  )
}
