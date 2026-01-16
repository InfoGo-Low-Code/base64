import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { ocrPdfToText } from '@/utils/ocrPdfToText'
import { PDFParse } from 'pdf-parse'

export function ocr(app: FastifyZodTypedInstance) {
  app.post(
    '/ocr',
    {
      schema: {
        body: z.object({
          url: z.string(),
        }),
        response: {
          200: z.object({
            ocr: z.string(),
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

        let parsedText = (await new PDFParse({ data: pdfBuffer }).getText()).text

        if (!parsedText) { 
          parsedText = await ocrPdfToText(pdfBuffer)
        }

        return reply.send({ ocr: parsedText })
      } catch (e: any) {
        return reply.internalServerError(e.message)
      }
    },
  )
}
