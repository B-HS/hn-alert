import { GoogleGenAI } from '@google/genai'
import { db, summaries, tags, stories, type Story, type Comment, type NewSummary } from '@db'
import { eq, desc, sql } from 'drizzle-orm'
import { env } from '@config/env'
import { markStorySummarized } from '@services/hn-fetcher'

const ai = new GoogleGenAI({ apiKey: env.geminiApiKey })

type SummaryResult = {
    summary: string
    tags: string[]
}

export const summarizeStory = async (story: Story, storyComments: Comment[]): Promise<SummaryResult> => {
    const topComments = storyComments
        .filter((c) => c.depth === 0 && c.commentText)
        .slice(0, 10)
        .map((c) => c.commentText)
        .join('\n- ')

    const contentForSummary = story.contentSummary ?? story.storyText ?? ''
    const storyTags = (story.tags ?? []) as string[]

    const prompt = `
다음 Hacker News 게시물과 댓글들을 한국어로 상세히 요약해주세요.

제목: ${story.title}
URL: ${story.url ?? 'None'}
본문 요약: ${contentForSummary || 'None'}
점수: ${story.score}
댓글 수: ${story.descendants}

주요 댓글 (영어):
- ${topComments || 'None'}

요구사항:
1. 핵심 내용을 빠짐없이 파악하여 상세하게 요약 (최대 100줄)
2. 기술적 의의, 트렌드, 영향력 포함
3. 댓글에서 나온 주요 논점, 반론, 추가 정보 포함
4. 마크다운 형식 사용 가능 (제목, 불릿, 코드블록 등)
5. 원문의 중요한 세부사항을 놓치지 않도록 할 것

Respond ONLY with valid JSON in this exact format:
{"summary": "한국어 상세 요약 내용"}
`

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        })

        const text = response.text ?? ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)

        if (!jsonMatch) {
            return { summary: story.titleKo ?? story.title ?? '', tags: storyTags }
        }

        const parsed = JSON.parse(jsonMatch[0]) as { summary: string }
        return {
            summary: parsed.summary ?? story.titleKo ?? story.title ?? '',
            tags: storyTags,
        }
    } catch (error) {
        console.error('AI summarization failed:', error)
        return { summary: story.titleKo ?? story.title ?? '', tags: storyTags }
    }
}

export const saveSummary = async (storyId: number, result: SummaryResult, summaryType = 'daily') => {
    const summaryData: NewSummary = {
        storyId,
        summary: result.summary,
        tags: result.tags,
        summaryType,
    }

    await db
        .insert(summaries)
        .values(summaryData)
        .onDuplicateKeyUpdate({ set: { summary: result.summary, tags: result.tags, updatedAt: new Date() } })

    for (const tagName of result.tags) {
        await db
            .insert(tags)
            .values({ name: tagName, usageCount: 1 })
            .onDuplicateKeyUpdate({ set: { usageCount: sql`usage_count + 1` } })
    }

    await markStorySummarized(storyId)
}

export const summarizeAndSave = async (story: Story, storyComments: Comment[], summaryType = 'daily') => {
    const result = await summarizeStory(story, storyComments)
    await saveSummary(story.id, result, summaryType)
    return result
}

export const getSummaryByStoryId = async (storyId: number) => {
    const result = await db.select().from(summaries).where(eq(summaries.storyId, storyId)).limit(1)

    return result[0] ?? null
}

export const generateDigestSummary = async (
    digestType: 'daily' | 'weekly' | 'monthly',
    storySummaries: { title: string; titleKo?: string; summary: string; score: number; tags: string[] }[],
): Promise<string> => {
    const typeLabel = digestType === 'daily' ? '일간' : digestType === 'weekly' ? '주간' : '월간'

    const storiesText = storySummaries
        .map((s, i) => {
            const displayTitle = s.titleKo ?? s.title
            const tagsText = s.tags.length > 0 ? ` [${s.tags.join(', ')}]` : ''
            return `${i + 1}. [${s.score}점] ${displayTitle}${tagsText}\n   ${s.summary}`
        })
        .join('\n\n')

    const prompt = `
다음은 Hacker News ${typeLabel} 다이제스트입니다.
주요 스토리들을 종합하여 ${typeLabel} 기술 트렌드를 2-3 문단으로 요약해주세요.

스토리 목록:
${storiesText}

한국어로 작성해주세요. 마크다운 형식으로 작성해도 됩니다.
`

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        })

        return response.text ?? ''
    } catch (error) {
        console.error('Digest summarization failed:', error)
        return `${typeLabel} 다이제스트 생성에 실패했습니다.`
    }
}
