import { z } from 'zod'

export const returnExcelDataBodySchema = z.object({
  empresa: z.object({
    value: z.string(),
  }),
})
