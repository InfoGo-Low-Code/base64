import { FastifyZodTypedInstance } from "@/@types/fastifyZodTypedInstance"
import { ConnectionPool } from "mssql"

export type CNPJResponse = {
  razao_social: string
  descricao_tipo_de_logradouro: string
  logradouro: string
  numero: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  cnpj: string
}

export async function buscarCnpj(
  app: FastifyZodTypedInstance,
  db: ConnectionPool,
  inscricao: string,
  inscricaoCache: Map<string, any>
): Promise<CNPJResponse> {
  const { data } = await app.axios.get<CNPJResponse>(
    `https://brasilapi.com.br/api/cnpj/v1/${inscricao}`
  )

  if (inscricaoCache.has(inscricao)) {
    return inscricaoCache.get(inscricao)
  }

  inscricaoCache.set(inscricao, data)

  const { recordset } = await db.query(`
    SELECT
      *
    FROM eckermann_beneficiarios
    WHERE inscricaoBeneficiario = '${inscricao}'
  `)

  if (recordset.length < 1) {
    const nomeBeneficiario = data.razao_social
    const nomeBeneficiarioLimpo = data.razao_social.replace(/[^a-zA-Z0-9\s]/g, '')
      .toUpperCase()
      .trim()

    await db.query(`
      INSERT INTO eckermann_beneficiarios VALUES (
        '${data.cnpj}', '${nomeBeneficiario}', '${nomeBeneficiarioLimpo}'
      )
    `)
  }

  return data
}