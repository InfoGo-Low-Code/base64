import { app } from './app'
import { env } from './env'

const port = Number(env.PORT) || 8080

app.listen({ host: '0.0.0.0', port }).then(() => {
  console.log(`HTTP Server running on PORT ${env.PORT}`)
})
