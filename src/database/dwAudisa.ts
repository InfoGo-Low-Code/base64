import sql, { ConnectionPool, config as SQLConfig } from 'mssql'
import { env } from '@/env'

const { DB_USER_NEW, DB_PASSWORD_NEW, DB_SERVER_NEW, DB_PORT_NEW } = env

const dbConfig: SQLConfig = {
  user: DB_USER_NEW,
  password: DB_PASSWORD_NEW,
  server: DB_SERVER_NEW,
  database: 'dw_audisa',
  port: DB_PORT_NEW,
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
