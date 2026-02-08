import { db, stories, comments, type NewStory, type NewComment } from '@db'
import { eq, inArray, and, lt, gt, sql } from 'drizzle-orm'
import { parseUrlContent } from '@services/content-parser'
import { translateStoriesBatch, getExistingTags, updateTagUsage } from '@services/translator'

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0'

type StoryType = 'top' | 'best' | 'new'

type HNItem = {
    id: number
    type: 'story' | 'comment' | 'job' | 'poll' | 'pollopt'
    by?: string
    title?: string
    url?: string
    text?: string
    score?: number
    descendants?: number
    time?: number
    kids?: number[]
    parent?: number
    dead?: boolean
    deleted?: boolean
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const fetchStoryIds = async (type: StoryType): Promise<number[]> => {
    const endpoint = type === 'top' ? 'topstories' : type === 'best' ? 'beststories' : 'newstories'
    const response = await fetch(`${HN_API_BASE}/${endpoint}.json`)
    return response.json()
}

export const fetchItem = async (id: number): Promise<HNItem | null> => {
    try {
        const response = await fetch(`${HN_API_BASE}/item/${id}.json`)
        return response.json()
    } catch {
        return null
    }
}

export const fetchItemsBatch = async (ids: number[], batchSize = 10): Promise<(HNItem | null)[]> => {
    const results: (HNItem | null)[] = []

    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch.map(fetchItem))
        results.push(...batchResults)

        if (i + batchSize < ids.length) {
            await delay(100)
        }
    }

    return results
}

export const fetchCommentsRecursive = async (storyId: number, kids: number[], depth: number, maxDepth: number): Promise<NewComment[]> => {
    if (depth >= maxDepth || kids.length === 0) {
        return []
    }

    const items = await fetchItemsBatch(kids)
    const commentsList: NewComment[] = []

    for (const item of items) {
        if (!item || item.type !== 'comment') continue

        commentsList.push({
            id: item.id,
            storyId,
            parentId: item.parent ?? null,
            by: item.by ?? null,
            commentText: item.text ?? null,
            time: item.time ?? null,
            depth,
            dead: item.dead ?? false,
            deleted: item.deleted ?? false,
        })

        if (item.kids && item.kids.length > 0) {
            const childComments = await fetchCommentsRecursive(storyId, item.kids, depth + 1, maxDepth)
            commentsList.push(...childComments)
        }
    }

    return commentsList
}

export const syncStories = async (type: StoryType, limit = 100): Promise<{ synced: number; updated: number; parsed: number }> => {
    const storyIds = await fetchStoryIds(type)
    const targetIds = storyIds.slice(0, limit)

    const existingStories = await db
        .select({ id: stories.id, score: stories.score, descendants: stories.descendants })
        .from(stories)
        .where(inArray(stories.id, targetIds))

    const existingMap = new Map(existingStories.map((s) => [s.id, s]))

    const items = await fetchItemsBatch(targetIds)

    const newItems: HNItem[] = []
    const updateItems: HNItem[] = []

    for (const item of items) {
        if (!item || !['story', 'job', 'poll'].includes(item.type)) continue

        const existing = existingMap.get(item.id)
        if (existing) {
            updateItems.push(item)
        } else {
            newItems.push(item)
        }
    }

    let synced = 0
    let updated = 0
    let parsed = 0

    for (const item of updateItems) {
        const existing = existingMap.get(item.id)!
        const needsResummarize = item.score !== existing.score || item.descendants !== existing.descendants

        await db
            .update(stories)
            .set({
                score: item.score ?? 0,
                descendants: item.descendants ?? 0,
                needsResummarize,
                lastSyncedAt: new Date(),
            })
            .where(eq(stories.id, item.id))

        if (needsResummarize) updated++
    }

    if (newItems.length > 0) {
        console.log(`[Sync] Processing ${newItems.length} new stories...`)

        const urlContents: Map<number, string> = new Map()
        const parseErrors: Map<number, string> = new Map()

        for (const item of newItems) {
            if (item.url) {
                const parseResult = await parseUrlContent(item.url)
                if (parseResult.success && parseResult.content) {
                    urlContents.set(item.id, parseResult.content)
                    parsed++
                } else {
                    parseErrors.set(item.id, parseResult.error ?? 'Unknown error')
                }
            }
        }

        const existingTags = await getExistingTags()
        const storyInputs = newItems.map((item) => ({
            id: item.id,
            title: item.title ?? '',
            storyText: item.text ?? null,
            content: urlContents.get(item.id) ?? null,
        }))

        console.log(`[Sync] Sending ${storyInputs.length} stories to Gemini for translation...`)
        const translations = await translateStoriesBatch(storyInputs, existingTags)
        const translationMap = new Map(translations.map((t) => [t.id, t]))

        const allTags: string[] = []

        for (const item of newItems) {
            const translation = translationMap.get(item.id)

            const storyData: NewStory = {
                id: item.id,
                type,
                hnType: item.type,
                by: item.by ?? null,
                title: item.title ?? null,
                titleKo: translation?.titleKo ?? null,
                url: item.url ?? null,
                storyText: item.text ?? null,
                storyTextKo: translation?.storyTextKo ?? null,
                contentSummary: translation?.contentSummary ?? null,
                contentSummaryKo: translation?.contentSummaryKo ?? null,
                tags: translation?.tags ?? [],
                contentParsed: urlContents.has(item.id),
                parseError: parseErrors.get(item.id) ?? null,
                score: item.score ?? 0,
                descendants: item.descendants ?? 0,
                time: item.time ?? null,
                dead: item.dead ?? false,
                deleted: item.deleted ?? false,
                needsResummarize: true,
            }

            if (translation?.tags) {
                allTags.push(...translation.tags)
            }

            await db.insert(stories).values(storyData).onDuplicateKeyUpdate({ set: storyData })
            synced++

            if (item.kids && item.kids.length > 0) {
                const commentsList = await fetchCommentsRecursive(item.id, item.kids, 0, 50)

                if (commentsList.length > 0) {
                    await db.delete(comments).where(eq(comments.storyId, item.id))

                    for (let i = 0; i < commentsList.length; i += 100) {
                        const batch = commentsList.slice(i, i + 100)
                        await db.insert(comments).values(batch).onDuplicateKeyUpdate({ set: { id: sql`id` } })
                    }
                }
            }
        }

        if (allTags.length > 0) {
            await updateTagUsage([...new Set(allTags)])
        }
    }

    for (const item of updateItems) {
        if (item.kids && item.kids.length > 0) {
            const commentsList = await fetchCommentsRecursive(item.id, item.kids, 0, 50)

            if (commentsList.length > 0) {
                await db.delete(comments).where(eq(comments.storyId, item.id))

                for (let i = 0; i < commentsList.length; i += 100) {
                    const batch = commentsList.slice(i, i + 100)
                    await db.insert(comments).values(batch).onDuplicateKeyUpdate({ set: { id: sql`id` } })
                }
            }
        }
    }

    return { synced, updated, parsed }
}

export const syncAllTypes = async (): Promise<{
    top: { synced: number; updated: number; parsed: number }
    best: { synced: number; updated: number; parsed: number }
    new: { synced: number; updated: number; parsed: number }
}> => {
    const topResult = await syncStories('top', 30)
    const bestResult = await syncStories('best', 20)
    const newResult = await syncStories('new', 50)

    return {
        top: topResult,
        best: bestResult,
        new: newResult,
    }
}

export const getUnsummarizedStories = async (limit = 20) => {
    return db.select().from(stories).where(eq(stories.needsResummarize, true)).orderBy(stories.score).limit(limit)
}

export const getStoriesForPeriod = async (startTime: number, endTime: number, limit = 50) => {
    return db
        .select()
        .from(stories)
        .where(and(gt(stories.time, startTime), lt(stories.time, endTime)))
        .orderBy(stories.score)
        .limit(limit)
}

export const markStorySummarized = async (storyId: number) => {
    await db.update(stories).set({ needsResummarize: false }).where(eq(stories.id, storyId))
}

export const getCommentsByStoryId = async (storyId: number) => {
    return db.select().from(comments).where(eq(comments.storyId, storyId)).orderBy(comments.depth, comments.time)
}
