import { Hono } from 'hono'
import { renderToString } from 'react-dom/server'
import { Layout } from '../components/layout'
import { StoryCard } from '../components/story-card'
import { CommentTree } from '../components/comment-tree'
import { Pagination } from '../components/ui/pagination'
import { generateHTMLFromMarkdown } from '../lib/markdown'
import {
    fetchStories,
    fetchStoryDetail,
    fetchStoryCounts,
    fetchDigests,
    fetchDigestDetail,
    fetchTags,
    fetchTagStories,
} from '../lib/api-client'

export const pages = new Hono()

pages.get('/', async (c) => {
    const category = c.req.query('category') ?? 'top'
    const page = Math.max(1, Number(c.req.query('page') ?? 1))
    const perPage = 100
    const validCategories = ['top', 'new', 'best']
    const currentCategory = validCategories.includes(category) ? category : 'top'

    const [storiesData, countsData, latestDigestData] = await Promise.all([
        fetchStories(currentCategory, page, perPage),
        fetchStoryCounts(),
        fetchDigests('daily', 1).catch(() => ({ digests: [] })),
    ])

    const countMap = Object.fromEntries(countsData.counts.map((c) => [c.type, c.count]))
    const totalCount = countMap[currentCategory] ?? 0
    const totalPages = Math.ceil(totalCount / perPage)
    const latestDigest = latestDigestData.digests[0] ?? null

    const categoryLabels: Record<string, string> = { top: '인기', new: '최신', best: '베스트' }

    const html = renderToString(
        <Layout title={`HN Digest - ${categoryLabels[currentCategory]}`}>
            <div className='space-y-8'>
                {latestDigest && (
                    <section className='bg-primary text-primary-foreground rounded-xl p-6 shadow-lg'>
                        <h2 className='text-xl font-bold mb-2'>{latestDigest.title}</h2>
                        <div className='prose prose-invert prose-sm max-w-none opacity-90'>
                            {latestDigest.content.split('\n').slice(0, 3).join('\n')}...
                        </div>
                        <a
                            href={`/${latestDigest.digestType}/${latestDigest.digestKey}`}
                            className='inline-block mt-4 bg-background text-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90'>
                            전체 보기
                        </a>
                    </section>
                )}

                <section>
                    <div className='flex items-center gap-2 mb-4 flex-wrap'>
                        {validCategories
                            .filter((cat) => (countMap[cat] ?? 0) > 0)
                            .map((cat) => (
                                <a
                                    key={cat}
                                    href={`/?category=${cat}`}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                        currentCategory === cat
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-secondary-foreground hover:opacity-80'
                                    }`}>
                                    {categoryLabels[cat]}
                                    <span className='ml-1 opacity-70'>({countMap[cat]})</span>
                                </a>
                            ))}
                    </div>
                    <div className='space-y-3'>
                        {storiesData.stories.map((story) => (
                            <StoryCard key={story.id} story={story} summary={story.summary} />
                        ))}
                        {storiesData.stories.length === 0 && <p className='text-muted-foreground'>스토리가 없습니다.</p>}
                    </div>
                    <Pagination currentPage={page} totalPages={totalPages} baseUrl={`/?category=${currentCategory}`} />
                </section>
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/story/:id', async (c) => {
    const id = Number(c.req.param('id'))

    try {
        const data = await fetchStoryDetail(id)
        const s = data.story
        const summaryText = s.contentSummaryKo ?? data.summary?.summary ?? null
        const storyTags = (s.tags ?? data.summary?.tags ?? []) as string[]

        const getDomain = (url: string | null) => {
            if (!url) return null
            try {
                return new URL(url).hostname.replace('www.', '')
            } catch {
                return null
            }
        }

        const html = renderToString(
            <Layout title={s.titleKo ?? s.title ?? 'HN Digest'}>
                <article className='max-w-4xl mx-auto'>
                    <div className='bg-card rounded-lg shadow-sm border p-6 mb-6'>
                        <h1 className='text-2xl font-bold text-foreground mb-2'>{s.titleKo ?? s.title}</h1>
                        {s.titleKo && <p className='text-sm text-muted-foreground mb-4'>{s.title}</p>}

                        <div className='flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4'>
                            <span>{s.score} points</span>
                            <span>by {s.by}</span>
                            <span>{s.time ? new Date(s.time * 1000).toLocaleDateString('ko-KR') : ''}</span>
                            <span>{s.descendants ?? 0} comments</span>
                        </div>

                        {s.url && (
                            <a
                                href={s.url}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 mb-4'>
                                원문 보기 ({getDomain(s.url)})
                            </a>
                        )}

                        {storyTags.length > 0 && (
                            <div className='flex flex-wrap gap-2 mb-4'>
                                {storyTags.map((tag) => (
                                    <a
                                        key={tag}
                                        href={`/tag/${encodeURIComponent(tag)}`}
                                        className='px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm hover:opacity-80'>
                                        {tag}
                                    </a>
                                ))}
                            </div>
                        )}

                        {s.storyTextKo && (
                            <div className='bg-secondary/50 rounded-lg p-4 mb-4'>
                                <p className='text-foreground whitespace-pre-wrap'>{s.storyTextKo}</p>
                                {s.storyText && <p className='text-sm text-muted-foreground mt-2 whitespace-pre-wrap'>{s.storyText}</p>}
                            </div>
                        )}

                        {summaryText && (
                            <div className='border-t pt-4'>
                                <h2 className='text-lg font-semibold text-foreground mb-2'>요약</h2>
                                <p className='text-muted-foreground whitespace-pre-wrap'>{summaryText}</p>
                            </div>
                        )}
                    </div>

                    <section>
                        <h2 className='text-lg font-bold text-foreground mb-4'>댓글 ({data.comments.length})</h2>
                        <CommentTree comments={data.comments} />
                    </section>
                </article>
            </Layout>,
        )

        return c.html(`<!DOCTYPE html>${html}`)
    } catch {
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
})

pages.get('/daily', async (c) => {
    const data = await fetchDigests('daily', 30)

    const html = renderToString(
        <Layout title='일간 다이제스트'>
            <h1 className='text-2xl font-bold text-foreground mb-6'>일간 다이제스트</h1>
            <div className='space-y-4'>
                {data.digests.map((digest) => (
                    <a
                        key={digest.id}
                        href={`/daily/${digest.digestKey}`}
                        className='block bg-card rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow'>
                        <h3 className='font-medium text-card-foreground'>{digest.title}</h3>
                        <p className='text-sm text-muted-foreground mt-1'>{(digest.storyIds ?? []).length}개 스토리</p>
                    </a>
                ))}
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/daily/:date', async (c) => {
    const date = c.req.param('date')

    try {
        const data = await fetchDigestDetail('daily', date)
        const contentHTML = await generateHTMLFromMarkdown(data.digest.content)

        const html = renderToString(
            <Layout title={data.digest.title}>
                <div className='max-w-4xl mx-auto'>
                    <h1 className='text-2xl font-bold text-foreground mb-4'>{data.digest.title}</h1>
                    <div className='prose max-w-none bg-card rounded-lg p-6 shadow-sm border mb-8 dark:prose-invert'>
                        <div dangerouslySetInnerHTML={{ __html: String(contentHTML) }} />
                    </div>

                    <h2 className='text-xl font-bold text-foreground mb-4'>포함된 스토리</h2>
                    <div className='space-y-3'>
                        {data.stories.map((story) => (
                            <StoryCard key={story.id} story={story} summary={story.summary} />
                        ))}
                    </div>
                </div>
            </Layout>,
        )

        return c.html(`<!DOCTYPE html>${html}`)
    } catch {
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
})

pages.get('/weekly', async (c) => {
    const data = await fetchDigests('weekly', 12)

    const html = renderToString(
        <Layout title='주간 다이제스트'>
            <h1 className='text-2xl font-bold text-foreground mb-6'>주간 다이제스트</h1>
            <div className='grid gap-4 md:grid-cols-2'>
                {data.digests.map((digest) => (
                    <a
                        key={digest.id}
                        href={`/weekly/${digest.digestKey}`}
                        className='block bg-card rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow'>
                        <h3 className='font-medium text-card-foreground'>{digest.title}</h3>
                        <p className='text-sm text-muted-foreground mt-1'>{(digest.storyIds ?? []).length}개 스토리</p>
                    </a>
                ))}
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/weekly/:week', async (c) => {
    const week = c.req.param('week')

    try {
        const data = await fetchDigestDetail('weekly', week)

        const html = renderToString(
            <Layout title={data.digest.title}>
                <div className='max-w-4xl mx-auto'>
                    <h1 className='text-2xl font-bold text-foreground mb-4'>{data.digest.title}</h1>
                    <div className='prose max-w-none bg-card rounded-lg p-6 shadow-sm border mb-8'>
                        {data.digest.content.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                        ))}
                    </div>

                    <h2 className='text-xl font-bold text-foreground mb-4'>이번 주 인기 스토리</h2>
                    <div className='space-y-3'>
                        {data.stories.map((story) => (
                            <StoryCard key={story.id} story={story} summary={story.summary} />
                        ))}
                    </div>
                </div>
            </Layout>,
        )

        return c.html(`<!DOCTYPE html>${html}`)
    } catch {
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
})

pages.get('/monthly', async (c) => {
    const data = await fetchDigests('monthly', 12)

    const html = renderToString(
        <Layout title='월간 다이제스트'>
            <h1 className='text-2xl font-bold text-foreground mb-6'>월간 다이제스트</h1>
            <div className='grid gap-4 md:grid-cols-3'>
                {data.digests.map((digest) => (
                    <a
                        key={digest.id}
                        href={`/monthly/${digest.digestKey}`}
                        className='block bg-card rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow'>
                        <h3 className='font-medium text-card-foreground'>{digest.title}</h3>
                        <p className='text-sm text-muted-foreground mt-1'>{(digest.storyIds ?? []).length}개 스토리</p>
                    </a>
                ))}
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/monthly/:month', async (c) => {
    const month = c.req.param('month')

    try {
        const data = await fetchDigestDetail('monthly', month)

        const html = renderToString(
            <Layout title={data.digest.title}>
                <div className='max-w-4xl mx-auto'>
                    <h1 className='text-2xl font-bold text-foreground mb-4'>{data.digest.title}</h1>
                    <div className='prose max-w-none bg-card rounded-lg p-6 shadow-sm border mb-8'>
                        {data.digest.content.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                        ))}
                    </div>

                    <h2 className='text-xl font-bold text-foreground mb-4'>이번 달 인기 스토리</h2>
                    <div className='space-y-3'>
                        {data.stories.map((story) => (
                            <StoryCard key={story.id} story={story} summary={story.summary} />
                        ))}
                    </div>
                </div>
            </Layout>,
        )

        return c.html(`<!DOCTYPE html>${html}`)
    } catch {
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
})

pages.get('/tag/:name', async (c) => {
    const name = decodeURIComponent(c.req.param('name'))

    const data = await fetchTagStories(name, 1, 50)
    const summaryMap = new Map(data.summaries.map((s) => [s.storyId, s]))

    const html = renderToString(
        <Layout title={`태그: ${name}`}>
            <h1 className='text-2xl font-bold text-foreground mb-6'>{name}</h1>
            <div className='space-y-3'>
                {data.stories.length === 0 ? (
                    <p className='text-muted-foreground'>해당 태그의 스토리가 없습니다.</p>
                ) : (
                    data.stories.map((story) => <StoryCard key={story.id} story={story} summary={summaryMap.get(story.id)} />)
                )}
            </div>
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})

pages.get('/tags', async (c) => {
    const data = await fetchTags()

    const html = renderToString(
        <Layout title='태그 목록'>
            <h1 className='text-2xl font-bold text-foreground mb-6'>태그</h1>
            <div className='flex flex-wrap gap-2'>
                {data.tags.map((tag) => (
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

const HUB_API_URL = process.env.HUB_API_URL ?? 'https://api.gumyo.net'

pages.get('/subscribe', async (c) => {
    const html = renderToString(
        <Layout title='Discord 알림 구독'>
            <div className='max-w-2xl mx-auto'>
                <h1 className='text-2xl font-bold text-foreground mb-6'>Discord 알림 구독</h1>

                <div className='bg-card rounded-lg shadow-sm border p-6 mb-6'>
                    <h2 className='text-lg font-semibold text-card-foreground mb-4'>Webhook 등록</h2>
                    <form id='webhook-form' className='space-y-4'>
                        <div>
                            <label className='block text-sm font-medium text-foreground mb-1'>Webhook URL</label>
                            <input
                                type='url'
                                name='url'
                                required
                                placeholder='https://discord.com/api/webhooks/...'
                                className='w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary'
                            />
                        </div>
                        <div>
                            <label className='block text-sm font-medium text-foreground mb-2'>알림 유형</label>
                            <div className='flex gap-4'>
                                <label className='flex items-center gap-2'>
                                    <input type='checkbox' name='digestTypes' value='daily' defaultChecked className='rounded' />
                                    <span className='text-sm'>일간</span>
                                </label>
                                <label className='flex items-center gap-2'>
                                    <input type='checkbox' name='digestTypes' value='weekly' defaultChecked className='rounded' />
                                    <span className='text-sm'>주간</span>
                                </label>
                                <label className='flex items-center gap-2'>
                                    <input type='checkbox' name='digestTypes' value='monthly' defaultChecked className='rounded' />
                                    <span className='text-sm'>월간</span>
                                </label>
                            </div>
                        </div>
                        <div className='flex gap-2'>
                            <button type='submit' className='flex-1 bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90'>
                                등록하기
                            </button>
                            <button
                                type='button'
                                id='test-btn'
                                className='px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-90'>
                                테스트
                            </button>
                        </div>
                    </form>
                    <p id='form-message' className='mt-3 text-sm hidden'></p>
                </div>

                <div className='bg-card rounded-lg shadow-sm border p-6 mb-6'>
                    <h2 className='text-lg font-semibold text-card-foreground mb-4'>구독 해제</h2>
                    <form id='delete-form' className='space-y-4'>
                        <div>
                            <label className='block text-sm font-medium text-foreground mb-1'>Webhook URL</label>
                            <input
                                type='url'
                                name='url'
                                required
                                placeholder='등록했던 webhook URL 입력'
                                className='w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary'
                            />
                        </div>
                        <button type='submit' className='w-full bg-secondary text-secondary-foreground py-2 rounded-lg font-medium hover:opacity-90'>
                            구독 해제
                        </button>
                    </form>
                    <p id='delete-message' className='mt-3 text-sm hidden'></p>
                </div>

                <div className='bg-secondary/50 rounded-lg p-4 text-sm text-muted-foreground'>
                    <p className='font-medium text-foreground mb-2'>Discord Webhook 만드는 방법</p>
                    <ol className='list-decimal list-inside space-y-1'>
                        <li>Discord 서버 설정 &gt; 연동 &gt; 웹후크</li>
                        <li>새 웹후크 만들기</li>
                        <li>웹후크 URL 복사</li>
                        <li>위 폼에 붙여넣기</li>
                    </ol>
                </div>
            </div>

            <script
                dangerouslySetInnerHTML={{
                    __html: `
                const API_BASE = '${HUB_API_URL}/api/hn/webhooks/public';
                const form = document.getElementById('webhook-form');
                const msg = document.getElementById('form-message');

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const formData = new FormData(form);
                    const digestTypes = formData.getAll('digestTypes');

                    try {
                        const res = await fetch(API_BASE + '/register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                url: formData.get('url'),
                                digestTypes: digestTypes.length > 0 ? digestTypes : ['daily', 'weekly', 'monthly']
                            })
                        });
                        const data = await res.json();
                        if (res.ok) {
                            msg.textContent = '등록 완료! 다이제스트 발행 시 알림을 받으실 수 있습니다.';
                            msg.className = 'mt-3 text-sm text-green-600';
                            form.reset();
                        } else {
                            msg.textContent = data.error?.message || '등록 실패';
                            msg.className = 'mt-3 text-sm text-red-600';
                        }
                    } catch (err) {
                        msg.textContent = '오류가 발생했습니다.';
                        msg.className = 'mt-3 text-sm text-red-600';
                    }
                });

                document.getElementById('test-btn').addEventListener('click', async () => {
                    const url = form.url.value;
                    if (!url) {
                        msg.textContent = 'Webhook URL을 입력해주세요.';
                        msg.className = 'mt-3 text-sm text-red-600';
                        return;
                    }

                    const btn = document.getElementById('test-btn');
                    btn.textContent = '전송중...';
                    btn.disabled = true;

                    try {
                        const res = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                embeds: [{
                                    title: 'HN Digest 테스트',
                                    description: 'Webhook이 정상적으로 연결되었습니다!',
                                    color: 0x000000,
                                    timestamp: new Date().toISOString()
                                }]
                            })
                        });
                        if (res.ok) {
                            msg.textContent = '테스트 메시지 전송 성공!';
                            msg.className = 'mt-3 text-sm text-green-600';
                        } else {
                            msg.textContent = '테스트 실패 - URL을 확인해주세요.';
                            msg.className = 'mt-3 text-sm text-red-600';
                        }
                    } catch {
                        msg.textContent = '테스트 실패 - URL을 확인해주세요.';
                        msg.className = 'mt-3 text-sm text-red-600';
                    }
                    btn.textContent = '테스트';
                    btn.disabled = false;
                });

                const deleteForm = document.getElementById('delete-form');
                const deleteMsg = document.getElementById('delete-message');

                deleteForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!confirm('정말 구독을 해제하시겠습니까?')) return;

                    const formData = new FormData(deleteForm);
                    try {
                        const res = await fetch(API_BASE + '/unregister', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: formData.get('url') })
                        });
                        const data = await res.json();
                        if (res.ok) {
                            deleteMsg.textContent = '구독이 해제되었습니다.';
                            deleteMsg.className = 'mt-3 text-sm text-green-600';
                            deleteForm.reset();
                        } else {
                            deleteMsg.textContent = data.error?.message || '삭제 실패';
                            deleteMsg.className = 'mt-3 text-sm text-red-600';
                        }
                    } catch {
                        deleteMsg.textContent = '오류가 발생했습니다.';
                        deleteMsg.className = 'mt-3 text-sm text-red-600';
                    }
                });
            `,
                }}
            />
        </Layout>,
    )

    return c.html(`<!DOCTYPE html>${html}`)
})
