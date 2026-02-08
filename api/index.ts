import { handle } from '@hono/node-server/vercel'
import app from '../server'

export default handle(app)
