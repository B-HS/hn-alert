import { mkdir, cp, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'bun'

const OUTPUT_DIR = '.vercel/output'
const FUNC_DIR = join(OUTPUT_DIR, 'functions/index.func')
const STATIC_DIR = join(OUTPUT_DIR, 'static')

const buildCss = async () => {
    console.log('[build] Building CSS...')
    const proc = spawn({
        cmd: ['bunx', '@tailwindcss/cli', '-i', './styles/input.css', '-o', './public/styles.css', '--minify'],
        stdout: 'inherit',
        stderr: 'inherit',
    })
    await proc.exited
    if (proc.exitCode !== 0) {
        throw new Error('CSS build failed')
    }
}

const buildServer = async () => {
    console.log('[build] Building server...')
    const result = await Bun.build({
        entrypoints: ['./entry.ts'],
        outdir: FUNC_DIR,
        target: 'node',
        format: 'esm',
        naming: '[dir]/index.mjs',
        packages: 'bundle',
    })
    if (!result.success) {
        console.error('[build] Server build errors:', result.logs)
        throw new Error('Server build failed')
    }
}

const createVercelOutput = async () => {
    console.log('[build] Creating Vercel output files...')

    const config = {
        version: 3,
        routes: [
            { src: '/styles.css', dest: '/styles.css' },
            { handle: 'filesystem' },
            { src: '/(.*)', dest: '/' },
        ],
    }
    await writeFile(join(OUTPUT_DIR, 'config.json'), JSON.stringify(config, null, 2))

    const vcConfig = {
        runtime: 'nodejs20.x',
        handler: 'index.mjs',
        launcherType: 'Nodejs',
        maxDuration: 300,
    }
    await writeFile(join(FUNC_DIR, '.vc-config.json'), JSON.stringify(vcConfig, null, 2))

    await cp('./public/styles.css', join(STATIC_DIR, 'styles.css'))
}

const createDirectories = async () => {
    console.log('[build] Creating Vercel output directories...')
    await rm(OUTPUT_DIR, { recursive: true, force: true })
    await mkdir(FUNC_DIR, { recursive: true })
    await mkdir(STATIC_DIR, { recursive: true })
}

const main = async () => {
    try {
        await buildCss()
        await createDirectories()
        await buildServer()
        await createVercelOutput()
        console.log('[build] Vercel build completed successfully!')
    } catch (error) {
        console.error('[build] Build failed:', error)
        process.exit(1)
    }
}

main()
