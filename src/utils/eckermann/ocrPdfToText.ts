import ConvertAPI from 'convertapi'
import { env } from '@/env'
import { createWorker } from 'tesseract.js'

export async function ocrPdfToText(pdfPathOrUrl: string) {
  const { CONVERTAPI_SECRET } = env
  
  const convertapi = new ConvertAPI(CONVERTAPI_SECRET)

  const result = await convertapi.convert(
    'png',
    {
      File: pdfPathOrUrl,
    },
    'pdf',
  )

  const {
    files,
  } = result

  const pages = files.map(({ url }) => url)

  const worker = await createWorker('por')
  let fullText = ''

  for (const pageUrl of pages) {
    const { data: { text } } = await worker.recognize(pageUrl)
    fullText += text + '\n'
  }

  await worker.terminate()
  return fullText
}
