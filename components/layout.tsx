import type { FC, PropsWithChildren } from 'react'

type LayoutProps = PropsWithChildren<{
    title?: string
    description?: string
}>

export const Layout: FC<LayoutProps> = ({ children, title = 'HN Digest', description = 'Hacker News 일간/주간/월간 다이제스트' }) => {
    return (
        <html lang='ko'>
            <head>
                <meta charSet='UTF-8' />
                <meta name='viewport' content='width=device-width, initial-scale=1.0' />
                <meta name='description' content={description} />
                <title>{title}</title>
                <link rel='stylesheet' href='/styles.css' />
            </head>
            <body className='bg-background text-foreground min-h-screen flex flex-col'>
                <nav className='bg-primary text-primary-foreground shadow-md'>
                    <div className='max-w-6xl mx-auto px-4 py-3 flex items-center justify-between'>
                        <a href='/' className='text-xl font-bold hover:opacity-80'>
                            HN Digest
                        </a>
                        <div className='flex gap-4 text-sm'>
                            <a href='/daily' className='hover:opacity-80'>
                                일간
                            </a>
                            <a href='/weekly' className='hover:opacity-80'>
                                주간
                            </a>
                            <a href='/monthly' className='hover:opacity-80'>
                                월간
                            </a>
                            <a href='/tags' className='hover:opacity-80'>
                                태그
                            </a>
                        </div>
                    </div>
                </nav>
                <main className='max-w-6xl mx-auto px-4 py-6 flex-1 w-full'>{children}</main>
                <footer className='bg-secondary border-t'>
                    <div className='max-w-6xl mx-auto px-4 py-6 text-center text-muted-foreground text-sm'>
                        <p>Powered by Hacker News API & Gemini AI</p>
                    </div>
                </footer>
            </body>
        </html>
    )
}
