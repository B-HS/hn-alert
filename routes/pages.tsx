import { Hono } from 'hono'
import { renderToString } from 'react-dom/server'
import { db, stories, summaries, digests, comments, tags } from '@db'
import { eq, desc, and, inArray, sql } from 'drizzle-orm'
import { Layout } from '@components/layout'
import { StoryCard } from '@components/story-card'
import { CommentTree } from '@components/comment-tree'

export const pages = new Hono()

pages.get('/', async (c) => {
    const latestDigest = await db.select().from(digests).orderBy(desc(digests.createdAt)).limit(1)

    const recentStories = await db.select().from(stories).orderBy(desc(stories.time)).limit(20)

    const storyIds = recentStories.map((s) => s.id)
    const summaryList = storyIds.length > 0 ? await db.select().from(summaries).where(inArray(summaries.storyId, storyIds)) : []

    const summaryMap = new Map(summaryList.map((s) => [s.storyId, s]))

    const html = renderToString(
        <Layout title='HN Digest - 홈'>
            <div className='space-y-8'>
                {latestDigest[0] && (
                    <section className='bg-primary text-primary-foreground rounded-xl p-6 shadow-lg'>
                        <h2 className='text-xl font-bold mb-2'>{latestDigest[0].title}</h2>
                        <div className='prose prose-invert prose-sm max-w-none opacity-90'>
                            {latestDigest[0].content.split('\n').slice(0, 3).join('\n')}...
                        </div>
                        <a
                            href={`/${latestDigest[0].digestType}/${latestDigest[0].digestKey}`}
                            className='inline-block mt-4 bg-background text-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90'>
                            전체 보기
                        </a>
                    </section>
                )}

                <section>
                    <h2 className='text-xl font-bold text-foreground mb-4'>최신 스토리</h2>
                    <div className='space-y-3'>
                        {recentStories.map((story) => (
                            <StoryCard key={story.id} story={story} summary={summaryMap.get(story.id)} />
                        ))}
                    </div>
                </section>
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/story/:id', async (c) => {
    const id = Number(c.req.param('id'))

    const story = await db.select().from(stories).where(eq(stories.id, id)).limit(1)

    if (story.length === 0) {
        const html = renderToString(
            <Layout title='스토리를 찾을 수 없습니다'>
                <div className='text-center py-12'>
                    <h1 className='text-2xl font-bold text-foreground mb-4'>404</h1>
                    <p className='text-muted-foreground'>스토리를 찾을 수 없습니다.</p>
                    <a href='/' className='text-foreground hover:underline mt-4 inline-block'>
                        홈으로 돌아가기
                    </a>
                </div>
            </Layout>,
        )
        return c.html(`<!DOCTYPE html>${html}`, 404)
    }

    const summary = await db.select().from(summaries).where(eq(summaries.storyId, id)).limit(1)
    const commentList = await db.select().from(comments).where(eq(comments.storyId, id)).orderBy(comments.depth, comments.time)

    const html = renderToString(
        <Layout title={story[0].title ?? 'HN Digest'}>
            <article className='max-w-4xl mx-auto'>
                <StoryCard story={story[0]} summary={summary[0]} showFullSummary />

                <section className='mt-8'>
                    <h2 className='text-lg font-bold text-foreground mb-4'>댓글 ({commentList.length})</h2>
                    <CommentTree comments={commentList} />
                </section>
            </article>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/daily', async (c) => {
    const digestList = await db.select().from(digests).where(eq(digests.digestType, 'daily')).orderBy(desc(digests.createdAt)).limit(30)

    const html = renderToString(
        <Layout title='일간 다이제스트'>
            <h1 className='text-2xl font-bold text-foreground mb-6'>일간 다이제스트</h1>
            <div className='space-y-4'>
                {digestList.map((digest) => (
                    <a
                        key={digest.id}
                        href={`/daily/${digest.digestKey}`}
                        className='block bg-card rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow'>
                        <h3 className='font-medium text-card-foreground'>{digest.title}</h3>
                        <p className='text-sm text-muted-foreground mt-1'>{((digest.storyIds ?? []) as number[]).length}개 스토리</p>
                    </a>
                ))}
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/daily/:date', async (c) => {
    const date = c.req.param('date')

    const digest = await db
        .select()
        .from(digests)
        .where(and(eq(digests.digestType, 'daily'), eq(digests.digestKey, date)))
        .limit(1)

    if (digest.length === 0) {
        const html = renderToString(
            <Layout title='다이제스트를 찾을 수 없습니다'>
                <div className='text-center py-12'>
                    <h1 className='text-2xl font-bold text-foreground mb-4'>404</h1>
                    <p className='text-muted-foreground'>해당 날짜의 다이제스트를 찾을 수 없습니다.</p>
                </div>
            </Layout>,
        )
        return c.html(`<!DOCTYPE html>${html}`, 404)
    }

    const storyIds = (digest[0].storyIds ?? []) as number[]
    const storyList = storyIds.length > 0 ? await db.select().from(stories).where(inArray(stories.id, storyIds)) : []

    const summaryList = storyIds.length > 0 ? await db.select().from(summaries).where(inArray(summaries.storyId, storyIds)) : []

    const summaryMap = new Map(summaryList.map((s) => [s.storyId, s]))

    const html = renderToString(
        <Layout title={digest[0].title}>
            <div className='max-w-4xl mx-auto'>
                <h1 className='text-2xl font-bold text-foreground mb-4'>{digest[0].title}</h1>
                <div className='prose max-w-none bg-card rounded-lg p-6 shadow-sm border mb-8'>
                    {digest[0].content.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                    ))}
                </div>

                <h2 className='text-xl font-bold text-foreground mb-4'>포함된 스토리</h2>
                <div className='space-y-3'>
                    {storyList.map((story) => (
                        <StoryCard key={story.id} story={story} summary={summaryMap.get(story.id)} />
                    ))}
                </div>
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/weekly', async (c) => {
    const digestList = await db.select().from(digests).where(eq(digests.digestType, 'weekly')).orderBy(desc(digests.createdAt)).limit(12)

    const html = renderToString(
        <Layout title='주간 다이제스트'>
            <h1 className='text-2xl font-bold text-foreground mb-6'>주간 다이제스트</h1>
            <div className='grid gap-4 md:grid-cols-2'>
                {digestList.map((digest) => (
                    <a
                        key={digest.id}
                        href={`/weekly/${digest.digestKey}`}
                        className='block bg-card rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow'>
                        <h3 className='font-medium text-card-foreground'>{digest.title}</h3>
                        <p className='text-sm text-muted-foreground mt-1'>{((digest.storyIds ?? []) as number[]).length}개 스토리</p>
                    </a>
                ))}
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/weekly/:week', async (c) => {
    const week = c.req.param('week')

    const digest = await db
        .select()
        .from(digests)
        .where(and(eq(digests.digestType, 'weekly'), eq(digests.digestKey, week)))
        .limit(1)

    if (digest.length === 0) {
        const html = renderToString(
            <Layout title='다이제스트를 찾을 수 없습니다'>
                <div className='text-center py-12'>
                    <h1 className='text-2xl font-bold text-foreground mb-4'>404</h1>
                    <p className='text-muted-foreground'>해당 주차의 다이제스트를 찾을 수 없습니다.</p>
                </div>
            </Layout>,
        )
        return c.html(`<!DOCTYPE html>${html}`, 404)
    }

    const storyIds = (digest[0].storyIds ?? []) as number[]
    const storyList = storyIds.length > 0 ? await db.select().from(stories).where(inArray(stories.id, storyIds)).orderBy(desc(stories.score)) : []

    const summaryList = storyIds.length > 0 ? await db.select().from(summaries).where(inArray(summaries.storyId, storyIds)) : []

    const summaryMap = new Map(summaryList.map((s) => [s.storyId, s]))

    const html = renderToString(
        <Layout title={digest[0].title}>
            <div className='max-w-4xl mx-auto'>
                <h1 className='text-2xl font-bold text-foreground mb-4'>{digest[0].title}</h1>
                <div className='prose max-w-none bg-card rounded-lg p-6 shadow-sm border mb-8'>
                    {digest[0].content.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                    ))}
                </div>

                <h2 className='text-xl font-bold text-foreground mb-4'>이번 주 인기 스토리</h2>
                <div className='space-y-3'>
                    {storyList.map((story) => (
                        <StoryCard key={story.id} story={story} summary={summaryMap.get(story.id)} />
                    ))}
                </div>
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/monthly', async (c) => {
    const digestList = await db.select().from(digests).where(eq(digests.digestType, 'monthly')).orderBy(desc(digests.createdAt)).limit(12)

    const html = renderToString(
        <Layout title='월간 다이제스트'>
            <h1 className='text-2xl font-bold text-foreground mb-6'>월간 다이제스트</h1>
            <div className='grid gap-4 md:grid-cols-3'>
                {digestList.map((digest) => (
                    <a
                        key={digest.id}
                        href={`/monthly/${digest.digestKey}`}
                        className='block bg-card rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow'>
                        <h3 className='font-medium text-card-foreground'>{digest.title}</h3>
                        <p className='text-sm text-muted-foreground mt-1'>{((digest.storyIds ?? []) as number[]).length}개 스토리</p>
                    </a>
                ))}
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/monthly/:month', async (c) => {
    const month = c.req.param('month')

    const digest = await db
        .select()
        .from(digests)
        .where(and(eq(digests.digestType, 'monthly'), eq(digests.digestKey, month)))
        .limit(1)

    if (digest.length === 0) {
        const html = renderToString(
            <Layout title='다이제스트를 찾을 수 없습니다'>
                <div className='text-center py-12'>
                    <h1 className='text-2xl font-bold text-foreground mb-4'>404</h1>
                    <p className='text-muted-foreground'>해당 월의 다이제스트를 찾을 수 없습니다.</p>
                </div>
            </Layout>,
        )
        return c.html(`<!DOCTYPE html>${html}`, 404)
    }

    const storyIds = (digest[0].storyIds ?? []) as number[]
    const storyList = storyIds.length > 0 ? await db.select().from(stories).where(inArray(stories.id, storyIds)).orderBy(desc(stories.score)) : []

    const summaryList = storyIds.length > 0 ? await db.select().from(summaries).where(inArray(summaries.storyId, storyIds)) : []

    const summaryMap = new Map(summaryList.map((s) => [s.storyId, s]))

    const html = renderToString(
        <Layout title={digest[0].title}>
            <div className='max-w-4xl mx-auto'>
                <h1 className='text-2xl font-bold text-foreground mb-4'>{digest[0].title}</h1>
                <div className='prose max-w-none bg-card rounded-lg p-6 shadow-sm border mb-8'>
                    {digest[0].content.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                    ))}
                </div>

                <h2 className='text-xl font-bold text-foreground mb-4'>이번 달 인기 스토리</h2>
                <div className='space-y-3'>
                    {storyList.map((story) => (
                        <StoryCard key={story.id} story={story} summary={summaryMap.get(story.id)} />
                    ))}
                </div>
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/tag/:name', async (c) => {
    const name = decodeURIComponent(c.req.param('name'))

    const tagInfo = await db.select().from(tags).where(eq(tags.name, name)).limit(1)

    const summaryList = await db
        .select()
        .from(summaries)
        .where(sql`JSON_CONTAINS(${summaries.tags}, ${JSON.stringify([name])})`)
        .limit(50)

    const html = renderToString(
        <Layout title={`태그: ${name}`}>
            <h1 className='text-2xl font-bold text-foreground mb-6'>
                {name}
                {tagInfo[0] && <span className='text-sm font-normal text-muted-foreground ml-2'>({tagInfo[0].usageCount}개 스토리)</span>}
            </h1>
            <div className='space-y-3'>
                {summaryList.length === 0 ? (
                    <p className='text-muted-foreground'>해당 태그의 스토리가 없습니다.</p>
                ) : (
                    <p className='text-muted-foreground'>스토리를 불러오는 중...</p>
                )}
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/tags', async (c) => {
    const tagList = await db.select().from(tags).orderBy(desc(tags.usageCount)).limit(50)

    const html = renderToString(
        <Layout title='태그 목록'>
            <h1 className='text-2xl font-bold text-foreground mb-6'>태그</h1>
            <div className='flex flex-wrap gap-2'>
                {tagList.map((tag) => (
                    <a
                        key={tag.id}
                        href={`/tag/${encodeURIComponent(tag.name)}`}
                        className='bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full hover:bg-secondary/80 text-sm'>
                        {tag.name}
                        <span className='text-muted-foreground ml-1'>({tag.usageCount})</span>
                    </a>
                ))}
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})
