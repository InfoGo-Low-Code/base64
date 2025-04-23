import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

export function fastifyErrorHandler(
  error: FastifyError,
  _: FastifyRequest,
  reply: FastifyReply,
) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    const formattedErrors = error.validation.map((validation) => {
      return validation.params.issue
    })

    return reply.status(400).send({
      statusCode: 400,
      message: 'Validation fields failed',
      details: formattedErrors,
    })
  } else {
    return reply.send(error)
  }
}
