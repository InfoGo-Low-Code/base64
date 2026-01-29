import ConvertAPI from 'convertapi'
import { env } from '@/env'
import { createWorker } from 'tesseract.js'
import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'

export async function ocrPdfToTextMultiple(pdfBuffer: Buffer) {
  if (!existsSync(`./uploads`)) {
    mkdirSync(`./uploads`, { recursive: true })
  }

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

    const pagesOcr: { text: string, pageNumber: number }[] = []

    for (let idx = 0; idx < pages.length; idx++) {
      const pageUrl = pages[idx]

      const { data: { text } } = await worker.recognize(pageUrl)

      pagesOcr.push({ text, pageNumber: idx + 1 })
    }

    await worker.terminate()
    return pagesOcr
  } finally {
    // Remove o arquivo temporário
    await unlink(tempPath).catch(() => {})
  }
}
