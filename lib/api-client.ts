import type { Story, Summary, Comment, Digest, Tag, StoryWithSummary } from '../types/hn'

const HUB_API_URL = process.env.HUB_API_URL ?? 'https://api.gumyo.net'

type ApiResponse<T> = {
    success: true
    data: T
}

const apiFetch = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${HUB_API_URL}/api/hn${path}`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const json = (await res.json()) as ApiResponse<T>
    return json.data
}

export const fetchStories = async (type?: string, page = 1, limit = 20) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (type) params.set('type', type)
    return apiFetch<{ stories: StoryWithSummary[]; page: number; limit: number }>(`/stories?${params}`)
}

export const fetchStoryDetail = async (id: number) => {
    return apiFetch<{ story: Story; summary: Summary | null; comments: Comment[] }>(`/stories/${id}`)
}

export const fetchStoryCounts = async () => {
    return apiFetch<{ counts: { type: string; count: number }[] }>('/stories/counts')
}

export const fetchDigests = async (type: string, limit = 30) => {
    const params = new URLSearchParams({ type, limit: String(limit) })
    return apiFetch<{ digests: Digest[]; type: string; limit: number }>(`/digests?${params}`)
}

export const fetchDigestDetail = async (type: string, key: string) => {
    return apiFetch<{ digest: Digest; stories: StoryWithSummary[] }>(`/digests/${type}/${key}`)
}

export const fetchTags = async () => {
    return apiFetch<{ tags: Tag[] }>('/tags')
}

export const fetchTagStories = async (name: string, page = 1, limit = 50) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    return apiFetch<{ stories: Story[]; summaries: Summary[]; tag: string; page: number; limit: number }>(
        `/tags/${encodeURIComponent(name)}/stories?${params}`,
    )
}

export const fetchSearch = async (q: string, limit = 20) => {
    const params = new URLSearchParams({ q, limit: String(limit) })
    return apiFetch<{ stories: Story[]; query: string }>(`/search?${params}`)
}
