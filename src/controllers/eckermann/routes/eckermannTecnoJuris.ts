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
  createdAt: string
  dia: string
  efetivado: boolean
  faturar: boolean
  natureza: {
    valor1: string
  } | null
  processoId: string
  tipo: {
    valor1: string
  } | null
  unidade: {
    valor1: string
  } | null
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
  natureza: z.string(),
  processoId: z.string(),
  tipo: z.string(),
  unidade: z.string(),
  valor: z.number(),
  efetivado: z.number(),
  faturado: z.number(),
})

type DataReturn = z.infer<typeof dataReturn>

export function eckermannTecnoJuris(app: FastifyZodTypedInstance) {
  app.get(
    '/eckermann/tecnoJuris',
    {
      schema: {
        response: {
          200: z.object({
            registerAmount: z.number(),
            data: z.array(dataReturn),
          }),
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

      let beforeCursor: string | undefined
      let hasPreviousPage = true
      const allNodes: Node[] = []

      while (hasPreviousPage) {
        const { data } = await app.axios.post<DataNodes>(
          'https://eyz.tecnojuris1.com.br/graphql',
          {
            query: `
              query ($last: Int, $before: String) {
                valoresConnection(last: $last, before: $before) {
                  pageInfo {
                    hasPreviousPage
                    startCursor
                  }
                  nodes {
                    pessoaId
                    descricao
                    createdAt
                    dia
                    efetivado
                    faturar
                    natureza { valor1 }
                    processoId
                    tipo { valor1 }
                    unidade { valor1 }
                    valor
                  }
                }
              }
            `,
            variables: { last: 200, before: beforeCursor },
          },
          { headers: { AUTH_TOKEN: jwt_token } },
        )

        const connection = data.data.valoresConnection
        const nodes = connection.nodes

        const dataMinima = new Date('2025-09-15')

        // filtra apenas registros de 2025
        const registrosValidos = nodes.filter((n) => {
          if (!n) return false
          const dataRegistro = new Date(n.createdAt || n.dia)
          if (!dataRegistro) return false

          return dataRegistro >= dataMinima
        })

        // se encontrou algum registro de ano < 2025, já pode parar o loop
        const encontrouAnoAnterior = nodes.some((n) => {
          if (!n) return false
          const dataRegistro = new Date(n.createdAt || n.dia)
          if (!dataRegistro) return false

          return dataRegistro < dataMinima
        })

        if (encontrouAnoAnterior) {
          console.log(
            '🚨 Encontrado registro de ano anterior a 09/2025, parando o loop',
          )
          hasPreviousPage = false
          beforeCursor = undefined
        } else {
          hasPreviousPage = connection.pageInfo.hasPreviousPage
          beforeCursor = connection.pageInfo.startCursor
        }

        allNodes.push(...registrosValidos)

        // pequena pausa para não floodar a API
        await new Promise((r) => setTimeout(r, 200))
      }

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

          await new Promise((r) => setTimeout(r, 200))
        }),
      )

      const pessoaMap = new Map<string, string>()
      pessoasNomesIds.forEach((p) => {
        pessoaMap.set(p.id, p.nome)
      })

      const transformedData: DataReturn[] = allNodes
        .filter((node) => node !== null)
        .map((node) => {
          const cliente = pessoaMap.get(node.pessoaId) ?? 'Desconhecido'

          const valor = Number(node.valor.replace('-', ''))
          const data = new Date(node.createdAt).toISOString().split('T')[0]

          return {
            id: randomUUID(),
            cliente,
            descricao: node.descricao.trim(),
            data,
            efetivado: node.efetivado ? 1 : 0,
            faturado: node.efetivado ? 1 : 0,
            natureza: node.natureza ? node.natureza.valor1 : 'NÃO INFORMADO',
            processoId: node.processoId,
            tipo: node.tipo ? node.tipo.valor1 : 'NÃO INFORMADO',
            unidade: node.unidade ? node.unidade.valor1 : 'NÃO INFORMADO',
            valor,
          }
        })

      return reply.send({
        registerAmount: transformedData.length,
        data: transformedData,
      })
    },
  )
}
