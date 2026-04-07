import { defineConfig } from '@prisma/config'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node prisma/seed.js'
  },
  datasource: {
    // DIRECT_URL: conexión directa puerto 5432 — solo para migraciones CLI
    // DATABASE_URL: pooler puerto 6543 — para queries en runtime (prisma.js)
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL
  }
})
