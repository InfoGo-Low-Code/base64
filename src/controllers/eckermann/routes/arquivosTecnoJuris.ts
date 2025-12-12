import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { env } from '@/env'

const filesResponse = z.object({
  name: z.string(),
  itemId: z.string(),
  driveId: z.string(),
  downloadUrl: z.string(),
})

type FilesResponse = z.infer<typeof filesResponse>

export function arquivosTecnojuris(app: FastifyZodTypedInstance) {
  app.get(
    '/eckermann/arquivosTecnojuris',
    {
      schema: {
        response: {
          200: z.object({
            files: z.array(filesResponse)
          })
        }
      }
    },
    async (request, reply) => {
      const { CLIENT_ID_AZURE, CLIENT_SECRET_AZURE, TENANT_ID_AZURE } = env

      // O token de compartilhamento é o que o Graph espera para links 1drv.ms
      // A parte que codificamos é o CAMINHO da URL (tudo depois de 1drv.ms)
      // A string de compartilhamento final é:
      // u!aHR0cHM6Ly8xZHJ2Lm1zL2YvYy80YWUwYzc5OTEzYTA2NjY3L0Vzek5UYlg0OGtGTHFieTB3WVA3cEUwQk4tb2gtRG4tVmswOFpqUG9xZ3ZRZWc
      // O seu log mostra que você já está gerando a string base64Url corretamente,
      // mas o Graph não aceita o formato final que o seu código gera.

      // 💡 Vamos tentar usar apenas a parte do token do link:
      const shareUrl = 'https://uh1zfbiihzudpm-my.sharepoint.com/:f:/g/personal/gabrielsousa_eckermann_adv_br/Ek_73sCcqLtMp3-Nkq-JEzkBpRHwyGD_DHByQWjPRM16uQ?e=94cjMN'
      // const shareUrl = 'https://uh1zfbiihzudpm-my.sharepoint.com/:f:/g/personal/suporte_eckermann_adv_br/IgCzId0j7me3SrhXg7jr2D1yAZkZ2wtnfRVApkOqc7k-8Tw?e=HSP9Ap'
      // const shareUrl = 'https://gugadev-my.sharepoint.com/:f:/g/personal/gustavosouza_gugadev_onmicrosoft_com/IgCmKRdMclo8RrKnXAk3ZZTdAf6VMRxMry9yaBOC_y8Dm0c?e=Kh68yf'

      // Para links 1drv.ms, o Graph espera um formato específico.
      // 1. Extraia o ID de compartilhamento do link longo.
      // No seu link, o ID/caminho de compartilhamento é a string completa.

      // Apenas mude a URL de requisição para ter certeza que não há caracteres perdidos
      // (seu log do base64Url parece correto, mas o erro sugere o contrário)
      const base64Url = Buffer.from(shareUrl, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      // console.log('Token Base64 URL Gerado:', base64Url)

      try {
        const {
          data: {
            access_token
          }
        } = await app.axios.post<{ access_token: string }>(
          `https://login.microsoftonline.com/${TENANT_ID_AZURE}/oauth2/v2.0/token`,
          new URLSearchParams({
            client_id: CLIENT_ID_AZURE,
            client_secret: CLIENT_SECRET_AZURE,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials'
          }),
        )

        const { data: {
          id: folderId,
          parentReference
        } } = await app.axios.get<{
          id: string
          parentReference: {
            driveId: string
            id: string
          }
        }>(
          `https://graph.microsoft.com/v1.0/shares/u!${base64Url}/driveItem`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          },
        )
        
        const { driveId, id } = parentReference

        // console.log({id, folderId})

        const { data: {
          value: files
        } } = await app.axios.get<{
          value: {
            id: string
            name: string
            "@microsoft.graph.downloadUrl": string
          }[]
        }>(
          `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`
            }
          }
        )

        const formattedFiles: FilesResponse[] = files.map((file) => ({
          driveId,
          name: file.name,
          itemId: file.id,
          downloadUrl: file['@microsoft.graph.downloadUrl'],
        }))

        return reply.send({ files: formattedFiles })
      } catch (e: any) {
        if (e.response && e.response.data) {
          console.error('Resposta de erro do Graph:', e.response.data)
        }

        console.log(e)

        return reply.internalServerError(e.message)
      }
    },
  )
}
