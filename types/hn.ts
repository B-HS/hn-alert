export type Story = {
    id: number
    type: string
    hnType: string
    by: string | null
    title: string | null
    titleKo: string | null
    url: string | null
    storyText: string | null
    storyTextKo: string | null
    contentSummary: string | null
    contentSummaryKo: string | null
    tags: string[] | null
    contentParsed: boolean | null
    parseError: string | null
    score: number | null
    descendants: number | null
    time: number | null
    dead: boolean | null
    deleted: boolean | null
    lastSyncedAt: string | null
    needsResummarize: boolean | null
    createdAt: string | null
    updatedAt: string | null
}

export type Comment = {
    id: number
    storyId: number
    parentId: number | null
    by: string | null
    commentText: string | null
    time: number | null
    depth: number
    dead: boolean | null
    deleted: boolean | null
    createdAt: string | null
}

export type Summary = {
    id: number
    storyId: number
    summary: string
    tags: string[] | null
    summaryType: string
    model: string | null
    createdAt: string | null
    updatedAt: string | null
}

export type Digest = {
    id: number
    digestType: string
    digestKey: string
    title: string
    content: string
    storyIds: number[] | null
    createdAt: string | null
}

export type Tag = {
    id: number
    name: string
    category: string | null
    usageCount: number | null
    createdAt: string | null
}

export type StoryWithSummary = Story & {
    summary: Summary | null
}
