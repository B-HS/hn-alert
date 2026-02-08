import { Hono } from 'hono'
import { api } from '@routes/api'
import { cron } from '@routes/cron'
import { pages } from '@routes/pages'

const app = new Hono()

app.route('/api', api)
app.route('/api/cron', cron)
app.route('/', pages)

app.onError((err, c) => {
    console.error('Server error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
