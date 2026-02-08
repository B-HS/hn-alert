import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

type ParseResult = {
    success: boolean
    content?: string
    title?: string
    excerpt?: string
    error?: string
}

const FETCH_TIMEOUT = 10000
const PARSE_DELAY = 500

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const parseUrlContent = async (url: string): Promise<ParseResult> => {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; HNDigestBot/1.0)',
                'Accept': 'text/html,application/xhtml+xml',
            },
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: ${response.statusText}`,
            }
        }

        const contentType = response.headers.get('content-type') ?? ''
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            return {
                success: false,
                error: `Unsupported content type: ${contentType}`,
            }
        }

        const html = await response.text()
        const { document } = parseHTML(html)

        const reader = new Readability(document as Document)
        const article = reader.parse()

        if (!article || !article.textContent) {
            return {
                success: false,
                error: 'Failed to extract article content',
            }
        }

        await delay(PARSE_DELAY)

        return {
            success: true,
            content: article.textContent.trim(),
            title: article.title ?? undefined,
            excerpt: article.excerpt ?? undefined,
        }
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                return { success: false, error: 'Request timeout' }
            }
            return { success: false, error: error.message }
        }
        return { success: false, error: String(error) }
    }
}
