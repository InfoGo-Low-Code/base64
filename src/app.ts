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
import { base64ToPDF } from './controllers/base64ToPDF'
import { fastifyCors } from './plugins/fastifyCors'
import { cofapRoutes } from './controllers/cofap/cofap.routes'
import { urlFileToBase64 } from './controllers/urlFileToBase64'
import { eckermannRoutes } from './controllers/eckermann/eckermann.routes'
import { jsonToStringGemini } from './controllers/jsonToStringGemini'
import { invistaiiRoutes } from './controllers/invistaii/invistaii.routes'
import { audisaRoutes } from './controllers/audisa/audisa.routes'
import { fileExtensionConverter } from './controllers/fileExtensionConverter'
import { covabraRoutes } from './controllers/covabra/covabra.routes'
import { biogenRoutes } from './controllers/biogen/biogen.routes'

export const app = fastify({
  bodyLimit: 5 * 1024 * 1024
}).withTypeProvider<ZodTypeProvider>()

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
app.register(base64ToPDF)
app.register(cofapRoutes)
app.register(urlFileToBase64)
app.register(eckermannRoutes)
app.register(jsonToStringGemini)
app.register(invistaiiRoutes)
app.register(audisaRoutes)
app.register(fileExtensionConverter)
app.register(covabraRoutes)
app.register(biogenRoutes)