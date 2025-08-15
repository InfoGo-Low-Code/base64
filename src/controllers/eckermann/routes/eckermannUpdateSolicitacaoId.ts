import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { getEckermannConnection } from '@/database/eckermann'
import sql from 'mssql'
import { lookup } from 'mime-types'

export function solicitacoesPagamento(app: FastifyZodTypedInstance) {
  app.put(
    '/eckermann/solicitacoesPagamento/:id',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          tipo_despesa: z.string(),
          numero_processo: z.string(),
          suit: z.string(),
          nome_cliente: z.string(),
          fornecedor_favorecido: z.string(),
          cpf_cnpj_favorecido: z.string(),
          valor: z.number(),
          data_vencimento: z.string(),
          anexo: z.string().url(),
          nome_arquivo: z.string(),
          descricao_lancamento: z.string(),
          empresa: z.string(),
        }),
        response: {
          201: z.object({
            message: z.string(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const {
        tipo_despesa,
        numero_processo,
        suit,
        nome_cliente,
        fornecedor_favorecido,
        cpf_cnpj_favorecido,
        valor,
        data_vencimento,
        nome_arquivo,
        anexo,
        descricao_lancamento,
        empresa,
      } = request.body

      const [dia, mes, ano] = data_vencimento.split('/')

      const dataVencimentoFormatada = `${ano}-${mes}-${dia}`

      const dataVencimento = new Date(dataVencimentoFormatada)

      const id = `${numero_processo}&${suit}&${tipo_despesa}&${nome_cliente}&${valor}${dataVencimentoFormatada}${empresa}`

      try {
        let dataAnexo

        try {
          const { data } = await app.axios.get(anexo, {
            responseType: 'arraybuffer',
          })

          dataAnexo = data
        } catch (e) {
          return reply.badRequest('Arquivo Inválido ou Inacessável')
        }

        const buffer = Buffer.from(dataAnexo)

        const LIMITE_BYTES = 5 * 1024 * 1024 // 5 MB

        if (buffer.length > LIMITE_BYTES) {
          return reply.internalServerError(
            `Arquivo muito grande. Tamanho máximo permitido é ${LIMITE_BYTES / 1024 / 1024} MB`,
          )
        }

        const mimeType = lookup(nome_arquivo) || 'application/octet-stream'

        const db = await getEckermannConnection()

        await db
          .request()
          .input('id', sql.NVarChar, id)
          .input('tipo_despesa', sql.NVarChar, tipo_despesa)
          .input('numero_processo', sql.NVarChar, numero_processo)
          .input('suit', sql.NVarChar, suit)
          .input('nome_cliente', sql.NVarChar, nome_cliente)
          .input('fornecedor_favorecido', sql.NVarChar, fornecedor_favorecido)
          .input('cpf_cnpj_favorecido', sql.NVarChar, cpf_cnpj_favorecido)
          .input('valor', sql.Decimal(18, 2), valor)
          .input('data_vencimento', sql.Date, dataVencimento)
          .input('nome_arquivo', sql.NVarChar, nome_arquivo)
          .input('tipo_mime', sql.NVarChar, mimeType)
          .input('anexo', sql.VarBinary(sql.MAX), buffer)
          .input('descricao_lancamento', sql.NVarChar, descricao_lancamento)
          .input('empresa', sql.NVarChar, empresa)
          .input('url_arquivo', sql.NVarChar, anexo).query(`
            UPDATE eckermann_solicitacoes_pagamento
            SET tipo_despesa = @tipo_despesa,
                numero_processo = @numero_processo,
                suit = @suit,
                nome_cliente = @nome_cliente,
                fornecedor_favorecido = @fornecedor_favorecido,
                cpf_cnpj_favorecido = @cpf_cnpj_favorecido,
                valor = @valor,
                data_vencimento = @data_vencimento,
                nome_arquivo = @nome_arquivo,
                tipo_mime = @tipo_mime,
                anexo = @anexo,
                descricao_lancamento = @descricao_lancamento,
                empresa = @empresa,
                url_arquivo = @url_arquivo
            WHERE id = @id
          `)

        return reply.code(201).send({ message: 'Registro salvo com sucesso!' })
      } catch (e) {
        console.error(e)

        if (e instanceof sql.ConnectionError) {
          return reply.internalServerError(
            'Erro ao realizar Conexão ao Banco de Dados',
          )
        }

        if (e instanceof sql.RequestError) {
          return reply.internalServerError(
            'Erro ao realizar Requisição ao Banco de Dados',
          )
        }

        if (e instanceof sql.MSSQLError) {
          return reply.internalServerError('Erro de Banco de Dados')
        }

        return reply.internalServerError(
          'Erro inesperado ao processar a requisição',
        )
      }
    },
  )
}
