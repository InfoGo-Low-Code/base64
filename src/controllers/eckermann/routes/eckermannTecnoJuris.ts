import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { randomUUID } from 'node:crypto'

type JwtEckermannSchema = {
  usuario: {
    id: number
    email: string
    jwt_token: string
  }
}

type Node = {
  pessoaId: string
  descricao: string
  dia: string
  efetivado: boolean
  faturar: boolean
  natureza: {
    valor1: string
  }
  processoId: string
  tipo: {
    valor1: string
  }
  unidade: {
    valor1: string
  }
  valor: string
}

type DataNodes = {
  data: {
    valoresConnection: {
      pageInfo: {
        hasPreviousPage: boolean
        startCursor: string
      }
      nodes: Node[]
    }
  }
}

const dataReturn = z.object({
  id: z.string(),
  cliente: z.string(),
  descricao: z.string(),
  data: z.string(),
  efetivado: z.union([z.literal(0), z.literal(1)]),
  faturado: z.union([z.literal(0), z.literal(1)]),
  natureza: z.string(),
  processoId: z.string(),
  tipo: z.string(),
  unidade: z.string(),
  valor: z.number(),
})

type DataReturn = z.infer<typeof dataReturn>

export function eckermannTecnoJuris(app: FastifyZodTypedInstance) {
  app.get(
    '/eckermann/tecnoJuris',
    {
      schema: {
        response: {
          200: z.object({
            data: z.array(dataReturn)
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (_, reply) => {
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

      // let beforeCursor = ''
      // let hasPreviousPage: boolean = true
      const allNodes: Node[] = []

      const { data } = await app.axios.post<DataNodes>(
        'https://eyz.tecnojuris1.com.br/graphql',
        {
          query: `
            query ($last: Int) {
              valoresConnection(last: $last) {
                pageInfo {
                  hasPreviousPage
                  startCursor
                }
                nodes {
                  pessoaId
                  descricao
                  dia
                  efetivado
                  faturar
                  natureza {
                    valor1
                  }
                  processoId
                  tipo {
                    valor1
                  }
                  unidade {
                    valor1
                  }
                  valor
                }
              }
            }
          `,
          variables: { last: 100 },
        },
        { headers: { AUTH_TOKEN: jwt_token } },
      )

      const connection = data.data.valoresConnection
      const nodes = connection.nodes

      allNodes.push(...nodes)

      // while (hasPreviousPage) {
      //   const { data } = await app.axios.post<DataNodes>(
      //     'https://eyz.tecnojuris1.com.br/graphql',
      //     {
      //       query: `
      //         query ($last: Int, $before: String) {
      //           valoresConnection(last: $last, before: $before) {
      //             pageInfo {
      //               hasPreviousPage
      //               startCursor
      //             }
      //             nodes {
      //               pessoaId
      //               descricao
      //               dia
      //               efetivado
      //               faturar
      //               natureza {
      //                 valor1
      //               }
      //               processoId
      //               tipo {
      //                 valor1
      //               }
      //               unidade {
      //                 valor1
      //               }
      //               valor
      //             }
      //           }
      //         }
      //       `,
      //       variables: { last: 20, before: beforeCursor }
      //     },
      //     { headers: { AUTH_TOKEN: jwt_token } }
      //   )

      //   const connection = data.data.valoresConnection
      //   const nodes = connection.nodes

      //   console.log(nodes[19])

      //   const stopIndex = nodes.findIndex(n => {
      //     const year = new Date(n.dia).getFullYear()
      //     return year < 2025
      //   })

      //   if (stopIndex !== -1) {
      //     allNodes.push(...nodes.slice(0, stopIndex))
      //     console.log("Parando porque encontrei registro de ano < 2025")
      //     break
      //   }

      //   allNodes.push(...nodes)

      //   hasPreviousPage = connection.pageInfo.hasPreviousPage
      //   beforeCursor = connection.pageInfo.startCursor
      // }

      const pessoaIds = Array.from(new Set(allNodes.map((n) => n.pessoaId)))

      const pessoasNomesIds: { id: string; nome: string }[] = []

      await Promise.all(
        pessoaIds.map(async (id) => {
          const { data } = await app.axios.post<{
            data: {
              pessoasConnection: { nodes: { id: string; nome: string }[] }
            }
          }>(
            'https://eyz.tecnojuris1.com.br/graphql',
            {
              query: `
                query ($id: String) {
                  pessoasConnection(pessoaId: $id) {
                    nodes {
                      id
                      nome
                    }
                  }
                }
              `,
              variables: { id },
            },
            { headers: { AUTH_TOKEN: jwt_token } },
          )

          const { nodes } = data.data.pessoasConnection
          pessoasNomesIds.push(...nodes)
        }),
      )

      const pessoaMap = new Map<string, string>()
      pessoasNomesIds.forEach(p => {
        pessoaMap.set(p.id, p.nome)
      })

      const transformedData: DataReturn[] = allNodes.map((node) => {
        const cliente = pessoaMap.get(node.pessoaId) ?? 'Desconhecido'
        
        const valor = Number(node.valor.replace('-', ''))
        const data = new Date(node.dia).toLocaleDateString('pt-BR')

        return {
          id: randomUUID(),
          cliente,
          descricao: node.descricao.trim(),
          data,
          efetivado: !!node.efetivado ? 1 : 0,
          faturado: !!node.efetivado ? 1 : 0,
          natureza: node.natureza.valor1,
          processoId: node.processoId,
          tipo: node.tipo.valor1,
          unidade: node.unidade.valor1,
          valor,
        }
      })

      return reply.send({ data: transformedData })
    },
  )
}
