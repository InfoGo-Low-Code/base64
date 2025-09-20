import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'

const jwtEckermannSchema = z.object({
  usuario: z.object({
    id: z.number(),
    email: z.string(),
    jwt_token: z.string(),
  }),
})

type JwtEckermannSchema = z.infer<typeof jwtEckermannSchema>

export function eckermannTecnoJuris(app: FastifyZodTypedInstance) {
  app.get(
    '/eckermann/tecnoJuris',
    {
      schema: {
        response: {
          200: z.any(),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const {
        data: {
          usuario: { jwt_token },
        },
      } = await app.axios.post<JwtEckermannSchema>(
        'https://eyz.tecnojuris1.com.br/usuarios/sign_in.json',
        {
          usuario: {
            email: 'lmaximiano@eckermann.adv.br',
            password: 'CWRFBC',
            subdomain: 'eyz',
          },
        },
      )

      console.log(jwt_token)

      const { data } = await app.axios.post(
        'https://eyz.tecnojuris.com.br/graphql',
        {
          query: `
            pessoasConnection(first:	1,	pessoaId:	"1"){
                nodes{
                    nome
                }
            }
          `,
        },
      )

      console.log(data)
    },
  )
}
