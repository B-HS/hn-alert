import { Hono } from 'hono'
import { db, stories, summaries, digests, type NewDigest } from '@db'
import { eq, desc, and, gte, lte, inArray } from 'drizzle-orm'
import { syncAllTypes, getUnsummarizedStories, getCommentsByStoryId } from '@services/hn-fetcher'
import { summarizeAndSave, generateDigestSummary } from '@services/ai-summarizer'
import { sendDigestWebhook, createDigestPayload } from '@services/webhook'
import { env } from '@config/env'

export const cron = new Hono()

const verifyCronSecret = (c: { req: { header: (name: string) => string | undefined } }) => {
    const authHeader = c.req.header('Authorization')
    if (env.cronSecret && authHeader !== `Bearer ${env.cronSecret}`) {
        return false
    }
    return true
}

cron.get('/sync', async (c) => {
    if (!verifyCronSecret(c)) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
        const result = await syncAllTypes()
        return c.json({ success: true, synced: result })
    } catch (error) {
        console.error('Sync failed:', error)
        return c.json({ error: 'Sync failed', details: String(error) }, 500)
    }
})

cron.get('/daily', async (c) => {
    if (!verifyCronSecret(c)) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
        const unsummarized = await getUnsummarizedStories(30)

        for (const story of unsummarized) {
            const storyComments = await getCommentsByStoryId(story.id)
            await summarizeAndSave(story, storyComments, 'daily')
        }

        const today = new Date()
        const dateKey = today.toISOString().split('T')[0]

        const recentSummaries = await db
            .select()
            .from(summaries)
            .where(eq(summaries.summaryType, 'daily'))
            .orderBy(desc(summaries.createdAt))
            .limit(20)

        const storyIds = recentSummaries.map((s) => s.storyId)
        const storyList = storyIds.length > 0 ? await db.select().from(stories).where(inArray(stories.id, storyIds)) : []

        const storyMap = new Map(storyList.map((s) => [s.id, s]))

        const storySummaries = recentSummaries
            .map((s) => {
                const story = storyMap.get(s.storyId)
                return {
                    title: story?.title ?? '',
                    titleKo: story?.titleKo ?? undefined,
                    summary: s.summary,
                    url: story?.url ?? null,
                    score: story?.score ?? 0,
                    tags: (s.tags ?? []) as string[],
                }
            })
            .filter((s) => s.title)

        const digestContent = await generateDigestSummary('daily', storySummaries)

        const digestData: NewDigest = {
            digestType: 'daily',
            digestKey: dateKey,
            title: `일간 다이제스트 - ${dateKey}`,
            content: digestContent,
            storyIds,
        }

        await db
            .insert(digests)
            .values(digestData)
            .onDuplicateKeyUpdate({
                set: { content: digestContent, storyIds },
            })

        const payload = createDigestPayload('daily', dateKey, digestContent, storySummaries)
        const webhookResult = await sendDigestWebhook(payload)

        return c.json({
            success: true,
            summarized: unsummarized.length,
            webhook: webhookResult,
            date: dateKey,
        })
    } catch (error) {
        console.error('Daily digest failed:', error)
        return c.json({ error: 'Daily digest failed', details: String(error) }, 500)
    }
})

cron.get('/weekly', async (c) => {
    if (!verifyCronSecret(c)) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
        const now = new Date()
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - 7)

        const startTimestamp = Math.floor(weekStart.getTime() / 1000)
        const endTimestamp = Math.floor(now.getTime() / 1000)

        const weeklyStories = await db
            .select()
            .from(stories)
            .where(and(gte(stories.time, startTimestamp), lte(stories.time, endTimestamp)))
            .orderBy(desc(stories.score))
            .limit(30)

        const storyIds = weeklyStories.map((s) => s.id)
        const summaryList = storyIds.length > 0 ? await db.select().from(summaries).where(inArray(summaries.storyId, storyIds)) : []

        const summaryMap = new Map(summaryList.map((s) => [s.storyId, s]))

        const storySummaries = weeklyStories
            .map((story) => {
                const summary = summaryMap.get(story.id)
                return {
                    title: story.title ?? '',
                    titleKo: story.titleKo ?? undefined,
                    summary: summary?.summary ?? '',
                    url: story.url ?? null,
                    score: story.score ?? 0,
                    tags: (summary?.tags ?? []) as string[],
                }
            })
            .filter((s) => s.title && s.summary)

        const year = now.getFullYear()
        const weekNum = getWeekNumber(now)
        const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`

        const digestContent = await generateDigestSummary('weekly', storySummaries)

        const digestData: NewDigest = {
            digestType: 'weekly',
            digestKey: weekKey,
            title: `주간 다이제스트 - ${weekKey}`,
            content: digestContent,
            storyIds,
        }

        await db
            .insert(digests)
            .values(digestData)
            .onDuplicateKeyUpdate({
                set: { content: digestContent, storyIds },
            })

        const payload = createDigestPayload('weekly', weekKey, digestContent, storySummaries)
        const webhookResult = await sendDigestWebhook(payload)

        return c.json({
            success: true,
            stories: weeklyStories.length,
            webhook: webhookResult,
            week: weekKey,
        })
    } catch (error) {
        console.error('Weekly digest failed:', error)
        return c.json({ error: 'Weekly digest failed', details: String(error) }, 500)
    }
})

cron.get('/monthly', async (c) => {
    if (!verifyCronSecret(c)) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

        const startTimestamp = Math.floor(monthStart.getTime() / 1000)
        const endTimestamp = Math.floor(now.getTime() / 1000)

        const monthlyStories = await db
            .select()
            .from(stories)
            .where(and(gte(stories.time, startTimestamp), lte(stories.time, endTimestamp)))
            .orderBy(desc(stories.score))
            .limit(50)

        const storyIds = monthlyStories.map((s) => s.id)
        const summaryList = storyIds.length > 0 ? await db.select().from(summaries).where(inArray(summaries.storyId, storyIds)) : []

        const summaryMap = new Map(summaryList.map((s) => [s.storyId, s]))

        const storySummaries = monthlyStories
            .map((story) => {
                const summary = summaryMap.get(story.id)
                return {
                    title: story.title ?? '',
                    titleKo: story.titleKo ?? undefined,
                    summary: summary?.summary ?? '',
                    url: story.url ?? null,
                    score: story.score ?? 0,
                    tags: (summary?.tags ?? []) as string[],
                }
            })
            .filter((s) => s.title && s.summary)

        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

        const digestContent = await generateDigestSummary('monthly', storySummaries)

        const digestData: NewDigest = {
            digestType: 'monthly',
            digestKey: monthKey,
            title: `월간 다이제스트 - ${monthKey}`,
            content: digestContent,
            storyIds,
        }

        await db
            .insert(digests)
            .values(digestData)
            .onDuplicateKeyUpdate({
                set: { content: digestContent, storyIds },
            })

        const payload = createDigestPayload('monthly', monthKey, digestContent, storySummaries)
        const webhookResult = await sendDigestWebhook(payload)

        return c.json({
            success: true,
            stories: monthlyStories.length,
            webhook: webhookResult,
            month: monthKey,
        })
    } catch (error) {
        console.error('Monthly digest failed:', error)
        return c.json({ error: 'Monthly digest failed', details: String(error) }, 500)
    }
})

const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
