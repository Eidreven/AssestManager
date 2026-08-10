import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createClient } from '@libsql/client'

test('legacy duplicate serial numbers do not block schema initialization', async () => {
  const databasePath = join(tmpdir(), `asset-manager-migration-${process.pid}-${Date.now()}.db`)
  const client = createClient({ url: `file:${databasePath}` })

  await client.execute(`
    CREATE TABLE locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  await client.execute("INSERT INTO locations (name) VALUES ('Legacy Room')")
  await client.execute(`
    CREATE TABLE assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_tag TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      model TEXT,
      serial_number TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      location_id INTEGER,
      notes TEXT,
      purchase_date TEXT,
      warranty_expiry TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  await client.batch([
    { sql: 'INSERT INTO assets (asset_tag, name, type, serial_number) VALUES (?, ?, ?, ?)', args: ['IT-001', 'Laptop 1', 'Laptop', 'LEGACY-001'] },
    { sql: 'INSERT INTO assets (asset_tag, name, type, serial_number) VALUES (?, ?, ?, ?)', args: ['IT-002', 'Laptop 2', 'Laptop', 'LEGACY-001'] },
  ])
  client.close()

  process.env.TURSO_DATABASE_URL = `file:${databasePath}`
  delete process.env.SKIP_DB_SCHEMA_INIT
  const { db } = await import('../lib/db')
  const [assets, locations] = await Promise.all([db.getAllAssets(), db.getAllLocations()])

  assert.equal(assets.length, 2)
  assert.equal(assets[0].asset_class, 'it')
  assert.equal(locations[0].name, 'Legacy Room')
  assert.equal(locations[0].location_type, 'other')
})
