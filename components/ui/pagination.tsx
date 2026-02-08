import type { FC } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type PaginationProps = {
    currentPage: number
    totalPages: number
    baseUrl: string
}

export const Pagination: FC<PaginationProps> = ({ currentPage, totalPages, baseUrl }) => {
    if (totalPages <= 1) return null

    const getPageUrl = (page: number) => {
        const separator = baseUrl.includes('?') ? '&' : '?'
        return `${baseUrl}${separator}page=${page}`
    }

    const pages: (number | string)[] = []
    const showPages = 5

    if (totalPages <= showPages + 2) {
        for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
        pages.push(1)
        if (currentPage > 3) pages.push('...')

        const start = Math.max(2, currentPage - 1)
        const end = Math.min(totalPages - 1, currentPage + 1)
        for (let i = start; i <= end; i++) pages.push(i)

        if (currentPage < totalPages - 2) pages.push('...')
        pages.push(totalPages)
    }

    return (
        <nav className='flex items-center justify-center gap-1 mt-8'>
            <a
                href={currentPage > 1 ? getPageUrl(currentPage - 1) : undefined}
                className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
                    currentPage > 1
                        ? 'hover:bg-secondary cursor-pointer'
                        : 'opacity-30 cursor-not-allowed'
                }`}>
                <ChevronLeft className='w-4 h-4' />
            </a>

            {pages.map((page, i) =>
                typeof page === 'string' ? (
                    <span key={`ellipsis-${i}`} className='w-10 h-10 flex items-center justify-center text-muted-foreground'>
                        {page}
                    </span>
                ) : (
                    <a
                        key={page}
                        href={getPageUrl(page)}
                        className={`flex items-center justify-center w-10 h-10 rounded-lg border font-medium transition-colors ${
                            page === currentPage
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'hover:bg-secondary'
                        }`}>
                        {page}
                    </a>
                ),
            )}

            <a
                href={currentPage < totalPages ? getPageUrl(currentPage + 1) : undefined}
                className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
                    currentPage < totalPages
                        ? 'hover:bg-secondary cursor-pointer'
                        : 'opacity-30 cursor-not-allowed'
                }`}>
                <ChevronRight className='w-4 h-4' />
            </a>
        </nav>
    )
}
