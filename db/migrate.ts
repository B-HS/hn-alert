import { migrate } from 'drizzle-orm/mysql2/migrator'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { env } from '@config/env'

const runMigrate = async () => {
    const connection = await mysql.createConnection({
        host: env.databaseHost,
        port: Number(env.databasePort) || 3306,
        user: env.databaseUsername,
        password: env.databasePassword,
        database: env.databaseName,
    })

    const db = drizzle(connection)

    console.log('Running migrations...')
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('Migrations completed!')

    await connection.end()
    process.exit(0)
}

runMigrate().catch((err) => {
    console.error('Migration failed!', err)
    process.exit(1)
})
