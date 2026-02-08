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
    const storyTags = (summary?.tags ?? []) as string[]

    return (
        <Card className='hover:shadow-md transition-shadow'>
            <CardHeader className='pb-2'>
                <div className='flex items-start gap-3'>
                    <div className='flex flex-col items-center text-foreground font-semibold text-sm min-w-[40px]'>
                        <ArrowUp className='w-4 h-4' />
                        <span>{story.score}</span>
                    </div>
                    <div className='flex-1 min-w-0'>
                        <CardTitle className='text-base font-medium'>
                            <a
                                href={story.url ?? `/story/${story.id}`}
                                target={story.url ? '_blank' : '_self'}
                                rel='noopener noreferrer'
                                className='hover:opacity-70 flex items-center gap-1'>
                                {story.title}
                                {story.url && <ExternalLink className='w-3 h-3 text-muted-foreground' />}
                            </a>
                        </CardTitle>
                        {domain && <span className='text-xs text-muted-foreground'>({domain})</span>}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {summary && <p className={cn('text-muted-foreground text-sm mb-3', !showFullSummary && 'line-clamp-2')}>{summary.summary}</p>}

                <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                    <span>by {story.by}</span>
                    <span>|</span>
                    <span>{formatDate(story.time)}</span>
                    <span>|</span>
                    <a href={`/story/${story.id}`} className='hover:text-foreground flex items-center gap-1'>
                        <MessageSquare className='w-3 h-3' />
                        {story.descendants ?? 0}
                    </a>

                    {storyTags.length > 0 && (
                        <>
                            <span>|</span>
                            <div className='flex gap-1'>
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
