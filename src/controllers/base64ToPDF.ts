import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { base64Decode } from 'base64topdf'
import { join } from 'node:path'
import { createReadStream, existsSync, mkdirSync, unlinkSync } from 'node:fs'

export function base64ToPDF(app: FastifyZodTypedInstance) {
  app.post(
    '/base64ToPDF',
    {
      schema: {
        body: z.object({
          base64: z.string(),
          filename: z.string(),
        }),
        response: {
          200: {
            description: 'PDF File Download',
          },
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { base64, filename } = request.body

      const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64

      if (!existsSync(`./uploads`)) {
        mkdirSync(`./uploads`, { recursive: true })
      }

      const fullFilename = `${filename}.pdf`
      const outputPath = join('./uploads', fullFilename)

      base64Decode(cleanBase64, outputPath)

      const download = createReadStream(outputPath)
      
      return reply
      .status(200)
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${fullFilename}"`)
      .send(download)
    },
  )
}
