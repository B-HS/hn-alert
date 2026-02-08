import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import app from './app'

const server = new Hono()

server.use('/styles.css', serveStatic({ path: './public/styles.css' }))
server.use('/static/*', serveStatic({ root: './public' }))

server.route('/', app)

export default server
