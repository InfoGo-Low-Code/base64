import postgres from 'postgres'
import { env } from '@/env'

const { DB_URL_COVABRA } = env

const covabra = postgres(DB_URL_COVABRA, {
  ssl: {
    rejectUnauthorized: false,
  },
})

export default covabra
