import { db, webhooks, webhookLogs, type Webhook } from '@db'
import { eq, and } from 'drizzle-orm'

type DigestPayload = {
    type: 'daily' | 'weekly' | 'monthly'
    date: string
    title: string
    content: string
    stories: { title: string; summary: string; url: string | null; score: number; tags: string[] }[]
}

type SendResult = {
    total: number
    success: number
    failed: number
    details: { webhookId: number; name: string | null; status: 'success' | 'failed' }[]
}

const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - 3) + '...'
}

const buildDiscordPayload = (payload: DigestPayload) => {
    const typeEmoji = payload.type === 'daily' ? '📰' : payload.type === 'weekly' ? '📅' : '📊'
    const typeLabel = payload.type === 'daily' ? '일간' : payload.type === 'weekly' ? '주간' : '월간'

    return {
        embeds: [
            {
                title: `${typeEmoji} HN ${typeLabel} 다이제스트 - ${payload.date}`,
                description: truncateText(payload.content, 2000),
                color: 0xff6600,
                timestamp: new Date().toISOString(),
            },
            ...payload.stories.slice(0, 5).map((story, index) => ({
                title: `${index + 1}. ${truncateText(story.title, 200)}`,
                description: truncateText(story.summary, 300),
                url: story.url ?? undefined,
                color: 0x333333,
                fields: [
                    { name: '점수', value: String(story.score), inline: true },
                    { name: '태그', value: story.tags.join(', ') || '없음', inline: true },
                ],
            })),
        ],
    }
}

const sendToWebhook = async (webhook: Webhook, payload: DigestPayload): Promise<boolean> => {
    try {
        let body: string

        if (webhook.provider === 'discord') {
            body = JSON.stringify(buildDiscordPayload(payload))
        } else {
            body = JSON.stringify(payload)
        }

        const response = await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        })

        await logWebhook(webhook.id, webhook.provider, payload.type, response.ok ? 'success' : 'failed', payload, await response.text())
        return response.ok
    } catch (error) {
        await logWebhook(webhook.id, webhook.provider, payload.type, 'failed', payload, String(error))
        return false
    }
}

const logWebhook = async (webhookId: number, provider: string, digestType: string, status: string, payload: DigestPayload, response: string) => {
    await db.insert(webhookLogs).values({
        webhookId,
        provider,
        digestType,
        status,
        payload: { type: payload.type, date: payload.date, storyCount: payload.stories.length },
        response: truncateText(response, 1000),
    })
}

export const getActiveWebhooks = async (digestType: 'daily' | 'weekly' | 'monthly') => {
    const allWebhooks = await db.select().from(webhooks).where(eq(webhooks.isActive, true))

    return allWebhooks.filter((w) => {
        const types = (w.digestTypes ?? []) as string[]
        return types.includes(digestType)
    })
}

export const sendDigestWebhook = async (payload: DigestPayload): Promise<SendResult> => {
    const activeWebhooks = await getActiveWebhooks(payload.type)

    const result: SendResult = {
        total: activeWebhooks.length,
        success: 0,
        failed: 0,
        details: [],
    }

    for (const webhook of activeWebhooks) {
        const success = await sendToWebhook(webhook, payload)

        if (success) {
            result.success++
        } else {
            result.failed++
        }

        result.details.push({
            webhookId: webhook.id,
            name: webhook.name,
            status: success ? 'success' : 'failed',
        })
    }

    return result
}

export const createDigestPayload = (
    type: 'daily' | 'weekly' | 'monthly',
    date: string,
    content: string,
    stories: { title: string; summary: string; url: string | null; score: number; tags: string[] }[],
): DigestPayload => {
    const typeLabel = type === 'daily' ? '일간' : type === 'weekly' ? '주간' : '월간'

    return {
        type,
        date,
        title: `HN ${typeLabel} 다이제스트 - ${date}`,
        content,
        stories,
    }
}

export const registerWebhook = async (url: string, name?: string, provider = 'discord', digestTypes = ['daily', 'weekly', 'monthly']) => {
    const result = await db.insert(webhooks).values({
        url,
        name: name ?? null,
        provider,
        digestTypes,
    })

    return result
}

export const unregisterWebhook = async (id: number) => {
    await db.update(webhooks).set({ isActive: false }).where(eq(webhooks.id, id))
}

export const deleteWebhook = async (id: number) => {
    await db.delete(webhooks).where(eq(webhooks.id, id))
}

export const listWebhooks = async () => {
    return db.select().from(webhooks).where(eq(webhooks.isActive, true))
}
