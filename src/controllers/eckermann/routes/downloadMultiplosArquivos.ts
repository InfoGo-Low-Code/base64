import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import AdmZip from 'adm-zip'
import { z } from 'zod'

export function downloadMultiplosArquivos(app: FastifyZodTypedInstance) {
  app.post(
    '/eckermann/downloadMultiplosArquivos',
    {
      schema: {
        body: z.object({
          links: z.array(z.string().url()),
          datas: z.array(z.string()),
          nomesArquivos: z.array(z.string()),
        }),
      },
    },
    async (request, reply) => {
      const { links, datas, nomesArquivos } = request.body

      const zipFile = new AdmZip()

      for (let idx = 0; idx < links.length; idx++) {
        const { data } = await app.axios.get(links[idx], {
          responseType: 'arraybuffer',
        })

        const filename = `${nomesArquivos[idx]}-${datas[idx]}`

        zipFile.addFile(filename, Buffer.from(data))
      }

      const zipBuffer = zipFile.toBuffer()

      reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', 'attachment; filename="arquivos.zip"')
        .send(zipBuffer)
    },
  )
}
