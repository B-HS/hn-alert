import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { api } from '@routes/api'
import { cron } from '@routes/cron'
import { pages } from '@routes/pages'

const app = new Hono()

app.use('/styles.css', serveStatic({ path: './public/styles.css' }))
app.use('/static/*', serveStatic({ root: './public' }))

app.route('/api', api)
app.route('/api/cron', cron)
app.route('/', pages)

app.onError((err, c) => {
    console.error('Server error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
