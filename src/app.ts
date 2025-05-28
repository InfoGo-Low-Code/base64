import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { fastifySensible } from '@fastify/sensible'
import { fastifyErrorHandler } from './plugins/fastifyErrorHandler'
import { uploadArchive } from './controllers/uploadArchive'
import { fastifyAxios } from './plugins/fastifyAxios'
import { fileToBase64 } from './controllers/fileToBase64'
import { fastifyMultipart } from './plugins/fastifyMultipart'
import { fastifySwagger } from './plugins/fastifySwagger'
import { fastifySwaggerUi } from './plugins/fastifySwaggerUi'
import { urlToBase64 } from './controllers/urlToBase64'
import { returnExcelDataEckermann } from './controllers/returnExcelDataEckermann'
import { base64ToPDF } from './controllers/base64ToPDF'
import { fastifyCors } from './plugins/fastifyCors'

export const app = fastify().withTypeProvider<ZodTypeProvider>()

app.setErrorHandler(fastifyErrorHandler)

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

app.register(fastifySensible)

fastifyCors(app)
fastifyMultipart(app)
fastifySwagger(app)
fastifySwaggerUi(app)
fastifyAxios(app)

app.register(uploadArchive)
app.register(fileToBase64)
app.register(urlToBase64)
app.register(returnExcelDataEckermann)
app.register(base64ToPDF)
