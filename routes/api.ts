import { Hono } from 'hono'
import { db, stories, summaries, tags, comments, webhooks } from '@db'
import { eq, desc, and, like, inArray, sql } from 'drizzle-orm'
import { registerWebhook, unregisterWebhook, deleteWebhook, listWebhooks, testWebhook } from '@services/webhook'

export const api = new Hono()

api.get('/stories', async (c) => {
    const type = c.req.query('type')
    const page = Number(c.req.query('page') ?? 1)
    const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)
    const offset = (page - 1) * limit

    const conditions = type ? eq(stories.type, type) : undefined

    const storyList = await db.select().from(stories).where(conditions).orderBy(desc(stories.time)).limit(limit).offset(offset)

    const storyIds = storyList.map((s) => s.id)

    const summaryList = storyIds.length > 0 ? await db.select().from(summaries).where(inArray(summaries.storyId, storyIds)) : []

    const summaryMap = new Map(summaryList.map((s) => [s.storyId, s]))

    const result = storyList.map((story) => ({
        ...story,
        summary: summaryMap.get(story.id) ?? null,
    }))

    return c.json({ stories: result, page, limit })
})

api.get('/stories/:id', async (c) => {
    const id = Number(c.req.param('id'))

    const story = await db.select().from(stories).where(eq(stories.id, id)).limit(1)

    if (story.length === 0) {
        return c.json({ error: 'Story not found' }, 404)
    }

    const summary = await db.select().from(summaries).where(eq(summaries.storyId, id)).limit(1)

    const commentList = await db.select().from(comments).where(eq(comments.storyId, id)).orderBy(comments.depth, comments.time)

    return c.json({
        story: story[0],
        summary: summary[0] ?? null,
        comments: commentList,
    })
})

api.get('/tags', async (c) => {
    const tagList = await db.select().from(tags).orderBy(desc(tags.usageCount))

    return c.json({ tags: tagList })
})

api.get('/tags/:name/stories', async (c) => {
    const name = c.req.param('name')
    const page = Number(c.req.query('page') ?? 1)
    const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)
    const offset = (page - 1) * limit

    const summaryList = await db
        .select()
        .from(summaries)
        .where(sql`JSON_CONTAINS(${summaries.tags}, ${JSON.stringify(name)})`)
        .orderBy(desc(summaries.createdAt))
        .limit(limit)
        .offset(offset)

    const storyIds = summaryList.map((s) => s.storyId)

    const storyList = storyIds.length > 0 ? await db.select().from(stories).where(inArray(stories.id, storyIds)) : []

    const storyMap = new Map(storyList.map((s) => [s.id, s]))

    const result = summaryList.map((summary) => ({
        story: storyMap.get(summary.storyId) ?? null,
        summary,
    }))

    return c.json({ stories: result, tag: name, page, limit })
})

api.get('/search', async (c) => {
    const q = c.req.query('q')
    const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

    if (!q) {
        return c.json({ error: 'Query is required' }, 400)
    }

    const storyList = await db
        .select()
        .from(stories)
        .where(like(stories.title, `%${q}%`))
        .orderBy(desc(stories.score))
        .limit(limit)

    return c.json({ stories: storyList, query: q })
})

api.get('/webhooks', async (c) => {
    const webhookList = await listWebhooks()
    return c.json({ webhooks: webhookList })
})

api.post('/webhooks', async (c) => {
    const body = await c.req.json<{
        url: string
        digestTypes?: string[]
    }>()

    if (!body.url) {
        return c.json({ error: 'URL is required' }, 400)
    }

    try {
        new URL(body.url)
    } catch {
        return c.json({ error: 'Invalid URL' }, 400)
    }

    const existing = await db.select().from(webhooks).where(eq(webhooks.url, body.url)).limit(1)
    if (existing.length > 0) {
        return c.json({ error: '이미 등록된 URL입니다' }, 400)
    }

    let name: string | null = null
    try {
        const res = await fetch(body.url)
        if (res.ok) {
            const data = await res.json() as { name?: string }
            name = data.name ?? null
        }
    } catch {}

    await registerWebhook(body.url, name, 'discord', body.digestTypes ?? ['daily', 'weekly', 'monthly'])

    return c.json({ success: true, message: 'Webhook registered', name })
})

api.delete('/webhooks/:id', async (c) => {
    const id = Number(c.req.param('id'))

    if (isNaN(id)) {
        return c.json({ error: 'Invalid ID' }, 400)
    }

    const existing = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1)

    if (existing.length === 0) {
        return c.json({ error: 'Webhook not found' }, 404)
    }

    await deleteWebhook(id)

    return c.json({ success: true, message: 'Webhook deleted' })
})

api.post('/webhooks/delete-by-url', async (c) => {
    const body = await c.req.json<{ url: string }>()

    if (!body.url) {
        return c.json({ error: 'URL is required' }, 400)
    }

    const existing = await db.select().from(webhooks).where(eq(webhooks.url, body.url))

    if (existing.length === 0) {
        return c.json({ error: 'Webhook not found' }, 404)
    }

    for (const webhook of existing) {
        await deleteWebhook(webhook.id)
    }

    return c.json({ success: true, message: `${existing.length}개 webhook 삭제됨` })
})

api.patch('/webhooks/:id/deactivate', async (c) => {
    const id = Number(c.req.param('id'))

    if (isNaN(id)) {
        return c.json({ error: 'Invalid ID' }, 400)
    }

    await unregisterWebhook(id)

    return c.json({ success: true, message: 'Webhook deactivated' })
})

api.post('/webhooks/:id/test', async (c) => {
    const id = Number(c.req.param('id'))

    if (isNaN(id)) {
        return c.json({ error: 'Invalid ID' }, 400)
    }

    const result = await testWebhook(id)

    if (!result.success && result.error) {
        return c.json({ error: result.error }, 404)
    }

    return c.json(result)
})
