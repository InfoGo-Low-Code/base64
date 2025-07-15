import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  INFOGO_KEY: z.string(),
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_SERVER: z.string(),
  DB_PORT: z.coerce.number().default(1433),
})

export const env = envSchema.parse(process.env)
