import {
  FastifyBaseLogger,
  FastifyInstance,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  RawServerDefault,
} from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export type FastifyZodTypedInstance = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>
