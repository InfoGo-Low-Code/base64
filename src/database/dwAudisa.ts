import sql, { ConnectionPool, config as SQLConfig } from 'mssql'
import { env } from '@/env'

const { DB_USER, DB_PASSWORD, DB_SERVER, DB_PORT } = env

const dbConfig: SQLConfig = {
  user: DB_USER,
  password: DB_PASSWORD,
  server: DB_SERVER,
  database: 'dw_audisa',
  port: DB_PORT,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
}

let pool: ConnectionPool

export async function getDwAudisaConnection(): Promise<ConnectionPool> {
  if (pool) return pool

  try {
    pool = await sql.connect(dbConfig)
    console.log('✅ Conectado ao SQL Server!')
    return pool
  } catch (error) {
    console.error('❌ Erro na conexão com SQL Server:', error)
    throw error
  }
}
