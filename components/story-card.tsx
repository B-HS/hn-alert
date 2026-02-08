import type { FC } from 'react'
import type { Story, Summary } from '@db/schema'
import { cn } from '@lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card'
import { Badge } from '@components/ui/badge'
import { ArrowUp, MessageSquare, ExternalLink } from 'lucide-react'

type StoryCardProps = {
    story: Story
    summary?: Summary | null
    showFullSummary?: boolean
}

const formatDate = (timestamp: number | null) => {
    if (!timestamp) return ''
    return new Date(timestamp * 1000).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

const getDomain = (url: string | null) => {
    if (!url) return null
    try {
        return new URL(url).hostname.replace('www.', '')
    } catch {
        return null
    }
}

export const StoryCard: FC<StoryCardProps> = ({ story, summary, showFullSummary = false }) => {
    const domain = getDomain(story.url)
    const storyTags = (story.tags ?? summary?.tags ?? []) as string[]
    const summaryText = story.contentSummaryKo ?? summary?.summary ?? null

    return (
        <Card className='hover:shadow-md transition-shadow'>
            <CardHeader className='pb-2'>
                <CardTitle className='text-base font-medium'>
                    <a href={`/story/${story.id}`} className='hover:opacity-70'>
                        {story.titleKo ?? story.title}
                    </a>
                </CardTitle>
                {story.titleKo && <p className='text-xs text-muted-foreground mt-1'>{story.title}</p>}
            </CardHeader>
            <CardContent>
                {summaryText && <p className={cn('text-muted-foreground text-sm mb-3', !showFullSummary && 'line-clamp-1')}>{summaryText}</p>}

                <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                    <span className='flex items-center gap-1'>
                        <ArrowUp className='w-3 h-3' />
                        {story.score}
                    </span>
                    <span>|</span>
                    <a href={`/story/${story.id}`} className='hover:text-foreground flex items-center gap-1'>
                        <MessageSquare className='w-3 h-3' />
                        {story.descendants ?? 0}
                    </a>
                    <span>|</span>
                    <span>by {story.by}</span>
                    <span>|</span>
                    <span>{formatDate(story.time)}</span>

                    {story.url && (
                        <>
                            <span>|</span>
                            <a
                                href={story.url}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='hover:text-foreground flex items-center gap-1'>
                                <ExternalLink className='w-3 h-3' />
                                {domain}
                            </a>
                        </>
                    )}

                    {storyTags.length > 0 && (
                        <>
                            <span>|</span>
                            <div className='flex flex-wrap gap-1'>
                                {storyTags.map((tag) => (
                                    <a key={tag} href={`/tag/${encodeURIComponent(tag)}`}>
                                        <Badge variant='secondary'>{tag}</Badge>
                                    </a>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
