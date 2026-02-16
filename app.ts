import { Hono } from 'hono'
import { pages } from './routes/pages'

const app = new Hono()

app.route('/', pages)

app.onError((err, c) => {
    console.error('Server error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
