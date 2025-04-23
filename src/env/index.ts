import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  INFOGO_KEY: z.string(),
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
})

export const env = envSchema.parse(process.env)
