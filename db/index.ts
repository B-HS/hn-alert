import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'
import { env } from '@config/env'

const poolConnection = mysql.createPool({
    host: env.databaseHost,
    port: parseInt(env.databasePort!),
    user: env.databaseUsername,
    database: env.databaseName,
    password: env.databasePassword,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
})

export const db = drizzle(poolConnection, { schema, mode: 'default' })

export * from './schema'
