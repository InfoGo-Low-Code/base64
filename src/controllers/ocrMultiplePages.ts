import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { PDFParse } from 'pdf-parse'
import { ocrPdfToTextMultiple } from '@/utils/ocrPdfToTextMultiple'

const pageSchema = z.object({
  text: z.string(),
  pageNumber: z.number(),
})

export function ocrMultiplePages(app: FastifyZodTypedInstance) {
  app.post(
    '/ocrMultiplePages',
    {
      schema: {
        body: z.object({
          url: z.string(),
        }),
        response: {
          200: z.object({
            ocr: z.array(pageSchema),
            commomText: z.array(pageSchema),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { url } = request.body

      try {
        const { data: pdfBuffer } = await app.axios.get(
          url,
          {
            responseType: "arraybuffer",
          }
        )

        const pdf = new PDFParse({ data: pdfBuffer })
        const parsedText = await pdf.getText()

        const pages: { text: string, pageNumber: number }[] = []

        parsedText.pages.forEach((page) => {
          pages.push({ text: page.text, pageNumber: page.num })
        })

        const pagesOcr = await ocrPdfToTextMultiple(pdfBuffer)

        return reply.send({ ocr: pagesOcr, commomText: pages })
      } catch (e: any) {
        return reply.internalServerError(e.message)
      }
    },
  )
}
