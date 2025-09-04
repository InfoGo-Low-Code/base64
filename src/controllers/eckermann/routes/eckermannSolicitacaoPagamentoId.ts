import { z } from 'zod'
import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { getEckermannConnection } from '@/database/eckermann'
import sql from 'mssql'

export function solicitacaoPagamentoId(app: FastifyZodTypedInstance) {
  app.get(
    '/eckermann/solicitacaoPagamentoId/:id',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            id: z.string(),
            tipo_despesa: z.string(),
            numero_processo: z.string(),
            suit: z.string(),
            nome_cliente: z.string(),
            fornecedor_favorecido: z.string(),
            cpf_cnpj_favorecido: z.string(),
            valor: z.number(),
            data_vencimento: z.string(),
            nome_arquivo: z.string(),
            tipo_mime: z.string(),
            anexo: z.string().nullable(),
            url_arquivo: z.string(),
            descricao_lancamento: z.string(),
            empresa: z.string(),
            email_gestor: z.string(),
            status: z.number(),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      try {
        const db = await getEckermannConnection()

        const result = await db.request().input('id', sql.NVarChar, id).query(`
            SELECT *
            FROM eckermann_solicitacoes_pagamento
            WHERE id = @id
          `)

        if (result.recordset.length === 0) {
          return reply.notFound('Registro não encontrado')
        }

        const registro = result.recordset[0]

        const anexoBase64 = registro.anexo
          ? Buffer.from(registro.anexo).toString('base64')
          : null

        return reply.code(200).send({
          id: registro.id,
          tipo_despesa: registro.tipo_despesa,
          numero_processo: registro.numero_processo,
          suit: registro.suit,
          nome_cliente: registro.nome_cliente,
          fornecedor_favorecido: registro.fornecedor_favorecido,
          cpf_cnpj_favorecido: registro.cpf_cnpj_favorecido,
          valor: parseFloat(registro.valor),
          data_vencimento: registro.data_vencimento.toISOString().split('T')[0],
          nome_arquivo: registro.nome_arquivo,
          tipo_mime: registro.tipo_mime,
          anexo: anexoBase64,
          descricao_lancamento: registro.descricao_lancamento,
          empresa: registro.empresa,
          url_arquivo: registro.url_arquivo,
          email_gestor: registro.email_gestor,
          status: registro.status,
        })
      } catch (err) {
        console.error(err)
        return reply.internalServerError('Erro ao buscar registro')
      }
    },
  )
}
