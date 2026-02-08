import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: './db/schema.ts',
    out: './drizzle',
    dialect: 'mysql',
    dbCredentials: {
        host: process.env.DATABASE_HOST!,
        port: parseInt(process.env.DATABASE_PORT!),
        database: process.env.DATABASE_NAME!,
        user: process.env.DATABASE_USERNAME!,
        password: process.env.DATABASE_PASSWORD!,
    },
})
