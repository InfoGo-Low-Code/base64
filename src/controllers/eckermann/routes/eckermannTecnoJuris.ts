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
  usuario: {
    nome: string
  }
}

type ValoresNodes = {
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

type JuridicoNodes = {
  data: {
    juridicoProcessosConnection: {
      nodes: {
        id: string
        pasta: string
        distribuicoes: {
          participacoes: {
            pessoa: {
              nome: string
              pessoaTipo: {
                valor1: string
              }
            }
          }[]
        }[]
      }[]
    }
  }
}

const dataReturn = z.object({
  id: z.string(),
  cliente: z.string(),
  descricao: z.string(),
  data: z.string(),
  natureza: z.string(),
  tipo: z.string(),
  unidade: z.string(),
  valor: z.number(),
  efetivado: z.number(),
  faturado: z.number(),
  pasta: z.string(),
  partesContrarias: z.string(),
  processoId: z.string(),
  poloCliente: z.string(),
  usuario: z.string(),
  validacao: z.string(),
})

type DataReturn = z.infer<typeof dataReturn>

async function processInBatches<T>(
  items: T[],
  handler: (item: T) => Promise<void>,
  batchSize = 15,
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(handler))
  }
}

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
    async (_, reply) => {
      try {
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

        let beforeCursor: string | undefined
        let hasPreviousPage = true
        const allNodes: Node[] = []

        while (hasPreviousPage) {
          const { data } = await app.axios.post<ValoresNodes>(
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
                    usuario {
                      nome
                    }
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

          const dataMinima = new Date('2025-10-01')

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

        const pessoaIds = Array.from(
          new Set(allNodes.map((n) => n.pessoaId).filter(Boolean)),
        )

        const pessoasNomesIds: { id: string; nome: string }[] = []

        await processInBatches(pessoaIds, async (id) => {
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
        })

        const pessoaMap = new Map<string, string>()
        pessoasNomesIds.forEach((p) => {
          pessoaMap.set(p.id, p.nome)
        })

        const processosId = Array.from(
          new Set(allNodes.map((n) => n.processoId).filter(Boolean)),
        )

        const pastasProcessos: {
          id: string
          pasta: string
          partesContrarias: string[]
          poloCliente: string[]
        }[] = []

        await processInBatches(processosId, async (id) => {
          const { data } = await app.axios.post<JuridicoNodes>(
            'https://eyz.tecnojuris1.com.br/graphql',
            {
              query: `
                query ($id: String) {
                  juridicoProcessosConnection(processoId: $id) {
                    nodes {
                      id
                      pasta
                      distribuicoes {
                        participacoes {
                          pessoa {
                            nome
                            pessoaTipo {
                              valor1
                              valor2
                            }
                          }
                        }
                      }
                    }
                  }
                }
              `,
              variables: { id },
            },
            { headers: { AUTH_TOKEN: jwt_token } },
          )

          const { nodes } = data.data.juridicoProcessosConnection

          nodes.forEach(({ id, pasta, distribuicoes = [] }) => {
            const participacoes = distribuicoes.flatMap(
              (d) => d.participacoes ?? [],
            )

            const partesContrarias = Array.from(
              new Set(
                participacoes
                  .filter(
                    (p) => p.pessoa.pessoaTipo?.valor1 === 'Parte Contrária',
                  )
                  .map((p) => p.pessoa.nome),
              ),
            )

            const clientes = participacoes.filter(
              (p) => p.pessoa.pessoaTipo?.valor1 === 'Cliente',
            )

            const poloCliente: string[] = []

            if (clientes.length > 0) {
              // Índice do primeiro Cliente
              const primeiroIndiceCliente = participacoes.findIndex(
                (p) => p.pessoa.pessoaTipo?.valor1 === 'Cliente',
              )

              // Se o primeiro cliente aparece na primeira posição geral → Autor
              if (primeiroIndiceCliente === 0) {
                poloCliente.push('Autor')
              }

              // Se há clientes em posições diferentes da primeira → Réu
              const haClienteForaDaPrimeiraPosicao = participacoes.some(
                (p, i) =>
                  p.pessoa.pessoaTipo?.valor1 === 'Cliente' &&
                  i !== primeiroIndiceCliente,
              )

              if (haClienteForaDaPrimeiraPosicao) {
                poloCliente.push('Réu')
              }
            }

            pastasProcessos.push({
              id,
              pasta,
              partesContrarias: partesContrarias ?? null,
              poloCliente,
            })
          })
        })

        const pastaMap = new Map<
          string,
          { pasta: string; partesContrarias: string[]; poloCliente: string[] }
        >()
        pastasProcessos.forEach((p) => {
          pastaMap.set(p.id, {
            pasta: p.pasta,
            partesContrarias: p.partesContrarias,
            poloCliente: p.poloCliente,
          })
        })

        const transformedData: DataReturn[] = allNodes
          .filter((node) => node !== null)
          .map((node) => {
            const cliente = pessoaMap.get(node.pessoaId) ?? 'NÃO INFORMADO'

            const pastaData = pastaMap.get(node.processoId)
            const pasta = pastaData?.pasta ?? 'NÃO INFORMADO'
            const partesContrarias =
              pastaData?.partesContrarias.join(', ') ?? 'NÃO INFORMADO'

            const valor = Number(node.valor.replace('-', ''))
            const data = new Date(node.createdAt).toISOString().split('T')[0]

            const tipo = node.tipo ? node.tipo.valor1 : 'NÃO INFORMADO'

            const unidade = node.unidade ? node.unidade.valor1 : 'NÃO INFORMADO'

            const poloCliente =
              pastaData?.poloCliente.join(', ') ?? 'NÃO INFORMADO'

            let validacao = 'OK'

            if (tipo === 'NÃO INFORMADO' || tipo === '' || tipo === null) {
              validacao = 'Tipo não preenchido'
            } else if (valor === null || valor === 0 || isNaN(valor)) {
              validacao = 'Valor não preenchido'
            } else if (
              ['custas processuais', 'depósito', 'erro interno'].includes(
                tipo.toLocaleLowerCase(),
              )
            ) {
              if (
                !unidade ||
                unidade.toLocaleLowerCase() !== 'despesas - custas'
              ) {
                validacao = 'Unidade incorreta para o tipo'
              }
            }

            return {
              id: randomUUID(),
              cliente,
              descricao: node.descricao.trim(),
              data,
              efetivado: node.efetivado === true ? 1 : 0,
              faturado: node.efetivado === true ? 1 : 0,
              natureza: node.natureza ? node.natureza.valor1 : 'NÃO INFORMADO',
              tipo,
              unidade,
              valor,
              pasta,
              partesContrarias,
              poloCliente,
              processoId: node.processoId,
              usuario: node.usuario.nome,
              validacao,
            }
          })

        return reply.send({
          registerAmount: transformedData.length,
          data: transformedData,
        })
      } catch (err: any) {
        console.error('Erro ao processar:', err)
        return reply.internalServerError(err.message)
      }
    },
  )
}
