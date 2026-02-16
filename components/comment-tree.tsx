import type { FC } from 'react'
import type { Comment } from '../types/hn'

type CommentTreeProps = {
    comments: Comment[]
}

type CommentItemProps = {
    comment: Comment
    children?: Comment[]
}

const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return ''
    const seconds = Math.floor(Date.now() / 1000 - timestamp)

    if (seconds < 60) return '방금 전'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}일 전`
    return `${Math.floor(seconds / 2592000)}개월 전`
}

const CommentItem: FC<CommentItemProps> = ({ comment, children = [] }) => {
    if (comment.deleted || comment.dead) {
        return <div className='pl-4 border-l-2 border-gray-200 py-2 text-gray-400 text-sm italic'>[삭제된 댓글]</div>
    }

    return (
        <div className='pl-4 border-l-2 border-gray-200 py-2'>
            <div className='flex items-center gap-2 text-xs text-gray-500 mb-1'>
                <span className='font-medium text-gray-700'>{comment.by}</span>
                <span>•</span>
                <span>{formatTimeAgo(comment.time)}</span>
            </div>
            <div className='text-sm text-gray-700 prose prose-sm max-w-none' dangerouslySetInnerHTML={{ __html: comment.commentText ?? '' }} />
            {children.length > 0 && (
                <div className='mt-2 space-y-2'>
                    {children.map((child) => (
                        <CommentItem key={child.id} comment={child} />
                    ))}
                </div>
            )}
        </div>
    )
}

export const CommentTree: FC<CommentTreeProps> = ({ comments }) => {
    const buildTree = (commentList: Comment[]) => {
        const map = new Map<number, Comment[]>()
        const roots: Comment[] = []

        commentList.forEach((comment) => {
            if (comment.depth === 0) {
                roots.push(comment)
            } else if (comment.parentId) {
                const siblings = map.get(comment.parentId) ?? []
                siblings.push(comment)
                map.set(comment.parentId, siblings)
            }
        })

        return { roots, childrenMap: map }
    }

    const { roots, childrenMap } = buildTree(comments)

    if (roots.length === 0) {
        return <div className='text-gray-500 text-center py-8'>아직 댓글이 없습니다.</div>
    }

    return (
        <div className='space-y-4'>
            {roots.map((comment) => (
                <CommentItem key={comment.id} comment={comment} children={childrenMap.get(comment.id) ?? []} />
            ))}
        </div>
    )
}
