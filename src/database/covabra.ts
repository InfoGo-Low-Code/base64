import postgres, { Options } from 'postgres'
import { env } from '@/env'

const { DB_USER_COVABRA, DB_PASSWORD_COVABRA, DB_HOST_COVABRA, DB_PORT_COVABRA } = env

const dbConfig: Options<{}> = {
  host: DB_HOST_COVABRA,
  username: DB_USER_COVABRA,
  password: DB_PASSWORD_COVABRA,
  port: DB_PORT_COVABRA,
  ssl: 'require'
}

const covabra = postgres(dbConfig)

export default covabra
