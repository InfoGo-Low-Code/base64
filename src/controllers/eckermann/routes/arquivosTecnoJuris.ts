import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { env } from '@/env'

export function arquivosTecnojuris(app: FastifyZodTypedInstance) {
  app.get(
    '/eckermann/arquivosTecnojuris',
    {
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

      console.log('Token Base64 URL Gerado:', base64Url)

      try {
        // ... (Obtenção do access_token - parece correta)

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

        // ⚠️ O erro 400 está aqui
        const graphResponse = await app.axios.get(
          `https://graph.microsoft.com/v1.0/shares/u!${base64Url}/driveItem`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          },
        )
        
        // Se a chamada for bem-sucedida, você pode retornar os dados da pasta
        return reply.send(graphResponse.data)

      } catch (e: any) {
        // O erro 400 ocorre na chamada ao Graph. Se o token Azure estiver ok,
        // o problema está na URL codificada.

        // Imprima o corpo da resposta de erro do Graph, se disponível.
        if (e.response && e.response.data) {
          console.error('Resposta de erro do Graph:', e.response.data)
        }

        console.log(e)

        return reply.internalServerError(e.message)
      }
    },
  )
}
