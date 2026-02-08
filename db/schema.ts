import { mysqlTable, int, varchar, text, timestamp, boolean, bigint, json, index } from 'drizzle-orm/mysql-core'

export const stories = mysqlTable(
    'stories',
    {
        id: bigint('id', { mode: 'number' }).primaryKey(),
        type: varchar('type', { length: 20 }).notNull(),
        hnType: varchar('hn_type', { length: 20 }).notNull(),
        by: varchar('by', { length: 100 }),
        title: text('title'),
        titleKo: text('title_ko'),
        url: text('url'),
        storyText: text('story_text'),
        storyTextKo: text('story_text_ko'),
        contentSummary: text('content_summary'),
        contentSummaryKo: text('content_summary_ko'),
        tags: json('tags').$type<string[]>().default([]),
        contentParsed: boolean('content_parsed').default(false),
        parseError: text('parse_error'),
        score: int('score').default(0),
        descendants: int('descendants').default(0),
        time: bigint('time', { mode: 'number' }),
        dead: boolean('dead').default(false),
        deleted: boolean('deleted').default(false),
        lastSyncedAt: timestamp('last_synced_at').defaultNow(),
        needsResummarize: boolean('needs_resummarize').default(true),
        createdAt: timestamp('created_at').defaultNow(),
        updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
    },
    (table) => [
        index('idx_stories_type').on(table.type),
        index('idx_stories_time').on(table.time),
        index('idx_stories_needs_resummarize').on(table.needsResummarize),
    ],
)

export const comments = mysqlTable(
    'comments',
    {
        id: bigint('id', { mode: 'number' }).primaryKey(),
        storyId: bigint('story_id', { mode: 'number' }).notNull(),
        parentId: bigint('parent_id', { mode: 'number' }),
        by: varchar('by', { length: 100 }),
        commentText: text('comment_text'),
        time: bigint('time', { mode: 'number' }),
        depth: int('depth').notNull().default(0),
        dead: boolean('dead').default(false),
        deleted: boolean('deleted').default(false),
        createdAt: timestamp('created_at').defaultNow(),
    },
    (table) => [index('idx_comments_story_id').on(table.storyId), index('idx_comments_parent_id').on(table.parentId)],
)

export const summaries = mysqlTable(
    'summaries',
    {
        id: int('id').primaryKey().autoincrement(),
        storyId: bigint('story_id', { mode: 'number' }).notNull().unique(),
        summary: text('summary').notNull(),
        tags: json('tags').$type<string[]>().default([]),
        summaryType: varchar('summary_type', { length: 20 }).notNull().default('daily'),
        model: varchar('model', { length: 50 }).default('gemini-2.5-flash-lite'),
        createdAt: timestamp('created_at').defaultNow(),
        updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
    },
    (table) => [index('idx_summaries_story_id').on(table.storyId), index('idx_summaries_type').on(table.summaryType)],
)

export const tags = mysqlTable('tags', {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    category: varchar('category', { length: 50 }),
    usageCount: int('usage_count').default(0),
    createdAt: timestamp('created_at').defaultNow(),
})

export const digests = mysqlTable(
    'digests',
    {
        id: int('id').primaryKey().autoincrement(),
        digestType: varchar('digest_type', { length: 20 }).notNull(),
        digestKey: varchar('digest_key', { length: 20 }).notNull(),
        title: varchar('title', { length: 200 }).notNull(),
        content: text('content').notNull(),
        storyIds: json('story_ids').$type<number[]>().default([]),
        createdAt: timestamp('created_at').defaultNow(),
    },
    (table) => [index('idx_digests_type_key').on(table.digestType, table.digestKey)],
)

export const webhooks = mysqlTable(
    'webhooks',
    {
        id: int('id').primaryKey().autoincrement(),
        provider: varchar('provider', { length: 20 }).notNull().default('discord'),
        url: text('url').notNull(),
        name: varchar('name', { length: 100 }),
        isActive: boolean('is_active').default(true),
        digestTypes: json('digest_types').$type<string[]>().default(['daily', 'weekly', 'monthly']),
        createdAt: timestamp('created_at').defaultNow(),
        updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
    },
    (table) => [index('idx_webhooks_provider').on(table.provider), index('idx_webhooks_active').on(table.isActive)],
)

export const webhookLogs = mysqlTable(
    'webhook_logs',
    {
        id: int('id').primaryKey().autoincrement(),
        webhookId: int('webhook_id'),
        provider: varchar('provider', { length: 20 }).notNull(),
        digestType: varchar('digest_type', { length: 20 }),
        status: varchar('status', { length: 20 }).notNull(),
        payload: json('payload'),
        response: text('response'),
        createdAt: timestamp('created_at').defaultNow(),
    },
    (table) => [index('idx_webhook_logs_webhook_id').on(table.webhookId)],
)

export type Story = typeof stories.$inferSelect
export type NewStory = typeof stories.$inferInsert
export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
export type Summary = typeof summaries.$inferSelect
export type NewSummary = typeof summaries.$inferInsert
export type Tag = typeof tags.$inferSelect
export type Digest = typeof digests.$inferSelect
export type NewDigest = typeof digests.$inferInsert
export type Webhook = typeof webhooks.$inferSelect
export type NewWebhook = typeof webhooks.$inferInsert
export type WebhookLog = typeof webhookLogs.$inferSelect
