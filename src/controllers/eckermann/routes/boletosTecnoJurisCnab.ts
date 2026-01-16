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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// =======================
// Schemas
// =======================

const infoFound = z.object({
  nomeArquivo: z.string(),
  boleto: z.custom<Boleto>().nullable(),
  dataPagamento: z.string().nullable(),
  beneficiario: z.string().nullable(),
})

type InfoFound = z.infer<typeof infoFound>

type FileData = {
  driveId: string
  itemId: string
  name: string
  downloadUrl: string
}

let roda = true

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
    id: string,
    cliente: string,
    valor: number,
    data: Date,
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
        beneficiario: null,
      }
    }
  
    const { data, pasta, valor } = parsedNome
  
    let idPastaProcesso = pasta
  
    if (![data, pasta, valor].every(v => v?.trim())) {
      return {
        nomeArquivo: name,
        boleto: null,
        dataPagamento: null,
        beneficiario: null
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

    const { data: dataFile } = await app.axios.post<{
      Result: {
        text: string
      }
    }>(
      'https://my-space-v-wco.api.integrasky.cloud/weCR3B7Wvd',
      {
        PDF: downloadUrl,
        Prompt: `Você é um especialista em boletos bancários brasileiros (FEBRABAN). A seguir está o arquivo de um boleto em PDF (via arquivo). Seu objetivo é identificar e retornar APENAS o NOME DO BENEFICIÁRIO DO BOLETO (quem recebe o pagamento). REGRAS IMPORTANTES: Beneficiário NÃO é o pagador, sacado, cliente ou devedor; Beneficiário também pode aparecer como Cedente, Favorecido ou termos equivalentes; Ignore nomes de pessoas físicas quando estiverem claramente identificadas como pagador/sacado; O nome do beneficiário normalmente aparece: próximo de rótulos como: Beneficiário, Cedente, Favorecido ou imediatamente acima de um CNPJ; Caso existam múltiplos nomes no documento, escolha aquele que claramente representa a empresa ou entidade que EMITIU o boleto. Retorne o nome exatamente como aparece no boleto, sem inventar ou corrigir. Se não for possível identificar com segurança, retorne: null. FORMATO DA RESPOSTA: Retorne apenas o nome encontrado`,
        Nome_Arquivo: name
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )

    const beneficiario = dataFile.Result.text

    await sleep(10000)
  
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
          beneficiario,
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
      SELECT id, cliente, valor, data
      FROM dw_hmetrix.dbo.eckermann_tecnojuris
      WHERE pasta LIKE '%${idPastaProcesso}%' AND valor = ${valorFormatado}
    `

    const { recordset } = await db.query<RecordsetDb[]>(query)
  
    if (recordset.length === 0) {
      console.log(query, recordset)
    }

    if (recordset.length > 0) {
      const dataPagamento = proximoDiaUtil(recordset[0].data.toISOString())

      // console.log(dataPagamento, recordset[0].data, new Date(recordset[0].data))

      await db
        .request()
        .input('id', sql.NVarChar(255), recordset[0].id)
        .input('codigoBarras', sql.NVarChar(255), parsedBoleto.codigoBarras)
        .input('linhaDigitavel', sql.NVarChar(255), parsedBoleto.linhaDigitavel)
        .input('dataPagamento', sql.Date, new Date(dataPagamento))
        .input('nomeBeneficiario', sql.NVarChar(255), beneficiario)
        .input('dataVencimentoBoleto', sql.Date, new Date(parsedBoleto.vencimentoComNovoFator2025))
        .query(`
          UPDATE dbo.eckermann_tecnojuris
          SET
            codigoBarras = @codigoBarras,
            linhaDigitavel = @linhaDigitavel,
            dataPagamento = @dataPagamento,
            statusPagamento = 'PENDENTE',
            nomeBeneficiario = @nomeBeneficiario,
            dataVencimentoBoleto = @dataVencimentoBoleto
          WHERE id = @id
        `)
      
      return {
        nomeArquivo: name,
        boleto: parsedBoleto,
        dataPagamento: dataPagamento.toISOString().substring(0, 10),
        beneficiario,
      }
    }

    return {
      nomeArquivo: name,
      boleto: parsedBoleto,
      dataPagamento: null,
      beneficiario,
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

      const limit = pLimit(3)

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
