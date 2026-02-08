export const env = {
    databaseUsername: process.env.DATABASE_USERNAME ?? '',
    databasePassword: process.env.DATABASE_PASSWORD ?? '',
    databaseHost: process.env.DATABASE_HOST ?? '',
    databasePort: process.env.DATABASE_PORT ?? '',
    databaseName: process.env.DATABASE_NAME ?? '',
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    cronSecret: process.env.CRON_SECRET ?? '',
}
