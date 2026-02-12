import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

export const generateHTMLFromMarkdown = async (markdownText: string) => {
    const processor = unified().use(remarkParse).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeStringify)

    return await processor.process(markdownText)
}
