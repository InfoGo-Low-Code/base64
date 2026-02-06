import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { randomUUID } from 'node:crypto'
import { createSmartKey } from '@/utils/eckermann/createSmartKey'
import { encryptTecnoJuris } from '@/utils/eckermann/cryptoTecnoJuris'

export type JwtEckermannSchema = {
  usuario: {
    id: number
    email: string
    jwt_token: string
  }
}

type Node = {
  distroId: string
  contaCredito: {
    valor1: string
  }
  contaDebito: {
    valor1: string
  } | null
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
  banco: z.string(),
  distribuicao: z.string(),
  smartKey: z.string(),
  iv: z.string(),
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

        const dataInicial = new Date()

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
                    contaCredito { valor1 }
                    contaDebito { valor1 }
                    pessoaId
                    descricao
                    distroId
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

          console.log(nodes[0].createdAt)

          const hoje = new Date()

          const dataMinima = new Date(
            hoje.getFullYear(),
            hoje.getMonth() - 1,
            1
          )

          // const dataMinima = new Date('2026-01-01')

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

        const dataTodos = new Date()

        console.log(`Tempo para pegar tudo: ${dataTodos.getTime() - dataInicial.getTime()}ms`)

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

        const dataPessoas = new Date()

        console.log(`Tempo para pegar pessoas: ${dataPessoas.getTime() - dataTodos.getTime()}ms`)

        const pessoaMap = new Map<string, string>()
        pessoasNomesIds.forEach((p) => {
          pessoaMap.set(p.id, p.nome)
        })

        // ===== DISTRUBIÇÕES POR ID =====
        const distribuicoesIds = Array.from(
          new Set(allNodes.map((n) => n.distroId).filter(Boolean))
        )

        const distribuicoesNomesIds: { id: string; numero: string }[] = []

        await processInBatches(distribuicoesIds, async (id) => {
          const { data } = await app.axios.post<{
            data: {
              juridicoDistribuicoesConnection: { nodes: { id: string, numero: string }[] }
            }
          }>(
            'https://eyz.tecnojuris1.com.br/graphql',
            {
              query: `
                query ($distroId: String) {
                  juridicoDistribuicoesConnection(distribuicaoId: $distroId) {
                    nodes {
                      id
                      numero
                    }
                  }
                }
              `,
              variables: { distroId: id },
            },
            { headers: { AUTH_TOKEN: jwt_token } },
          )

          const { nodes } = data.data.juridicoDistribuicoesConnection

          distribuicoesNomesIds.push(...nodes)
        })

        const dataDistribuicoes = new Date()

        console.log(`Tempo para pegar distribuições: ${dataDistribuicoes.getTime() - dataPessoas.getTime()}ms`)

        const distribuicaoMap = new Map<string, string>()
        distribuicoesNomesIds.forEach((p) => {
          distribuicaoMap.set(p.id, p.numero)
        })


        // ===== PROCESSOS POR ID =====
        const processosId = Array.from(
          new Set(allNodes.map((n) => n.processoId).filter(Boolean)),
        )

        const pastasProcessos: {
          id: string
          pasta: string
          partesContrarias: string[]
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

            pastasProcessos.push({
              id,
              pasta,
              partesContrarias: partesContrarias ?? null,
            })
          })
        })

        const dataPastasProcessos = new Date()

        const pastaMap = new Map<
        string,
        { pasta: string; partesContrarias: string[] }
        >()
        pastasProcessos.forEach((p) => {
          pastaMap.set(p.id, {
            pasta: p.pasta,
            partesContrarias: p.partesContrarias,
          })
        })

        console.log(`Tempo para pegar pastas/processos: ${dataPastasProcessos.getTime() - dataDistribuicoes.getTime()}ms`)
        
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

            const valorNatureza = node.natureza?.valor1 ?? ''

            let poloCliente: string

            if (valorNatureza.includes('ATIVAS') || valorNatureza.includes('CAPOLETTI')) {
              poloCliente = 'Autor'
            } else if (valorNatureza.includes('PASSIVAS')) {
              poloCliente = 'Réu'
            } else {
              poloCliente = 'Natureza Inválida'
            }

            const distribuicao = distribuicaoMap.get(node.distroId) ?? ''

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

            const { encrypted, iv } = encryptTecnoJuris(`${cliente};${data};${pasta};${valor};${processosId}`)

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
              processoId: node.processoId ?? 'NÃO INFORMADO',
              usuario: node.usuario.nome,
              validacao,
              banco: `${node.contaCredito ? node.contaCredito.valor1: ''}${node.contaDebito ? ` - ${node.contaDebito.valor1}` : ''}`,
              distribuicao,
              smartKey: encrypted,
              iv,
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
