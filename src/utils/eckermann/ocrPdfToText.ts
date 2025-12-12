import ConvertAPI from 'convertapi'
import { env } from '@/env'
import { createWorker } from 'tesseract.js'
import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export async function ocrPdfToText(pdfBuffer: Buffer) {
  const tempPath = `./uploads/${randomUUID()}.pdf`

  // console.log(tempPath)

  // Salva o buffer como arquivo temporário
  await writeFile(tempPath, pdfBuffer)

  try {
    const convertapi = new ConvertAPI(env.CONVERTAPI_SECRET)

    const result = await convertapi.convert(
      'png',
      { File: tempPath },
      'pdf'
    )

    const pages = result.files.map(f => f.url)

    const worker = await createWorker('por')
    let fullText = ''

    for (const pageUrl of pages) {
      const { data: { text } } = await worker.recognize(pageUrl)
      fullText += text + '\n'
    }

    await worker.terminate()
    return fullText

  } finally {
    // Remove o arquivo temporário
    await unlink(tempPath).catch(() => {})
  }
}
