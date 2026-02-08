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
# Role
너는 실리콘밸리의 시니어 소프트웨어 엔지니어이자 기술 전문 분석가이다. 
제공된 Hacker News 데이터를 바탕으로, 원문을 보지 않아도 될 수준의 '상세 기술 리포트'를 작성하라.

# Strict Constraints (절대 준수)
1. **분량 극대화**: 단순 요약이 아닌 '심층 분석'을 수행하라. 가능한 한 모든 디테일을 포함하여 **최대 25줄 내외**의 마크다운 리포트를 생성하라.
2. **기술적 상세 분석**: 본문에 언급된 아키텍처, 구현 방식, 사용된 스택 및 기술적 의의를 빠짐없이 서술하라.
3. **댓글 토론 정리**: 제공된 댓글들에서 나타난 찬성/반대 논거, 구체적인 벤치마크, 대안으로 제시된 기술 정보를 각각 별도의 섹션으로 상세히 기술하라.
4. **언어**: 한국어로 작성하되, 전문 기술 용어는 원문을 병기하거나 관용적인 표현을 사용하라.

# Information to Analyze
- 제목: ${story.title}
- URL: ${story.url ?? 'None'}
- 본문 요약: ${contentForSummary || 'None'}
- 통계: ${story.score} points, ${story.descendants} comments
- 주요 댓글 (English): 
${topComments || 'None'}

# Output Format
Respond ONLY with a valid JSON object.
{
    "summary": "마크다운(#, ##, 1., -, \` 등)을 활용한 25줄을 넘지않는 분량의 상세 리포트"
}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
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
            model: 'gemini-2.5-flash-lite',
            contents: prompt,
        })

        return response.text ?? ''
    } catch (error) {
        console.error('Digest summarization failed:', error)
        return `${typeLabel} 다이제스트 생성에 실패했습니다.`
    }
}
