# MPS School Asset Register

Asset management for Macfarlane Primary School, with separate registers for IT equipment and classroom assets.

## Features

- Separate IT and classroom asset registers
- Individual tracking for devices, smartboards, fridges, and valuable equipment
- Quantity tracking for chairs, tables, desks, and other grouped classroom items
- Good, fair, damaged, and missing condition counts
- QR labels, allocation history, requests, maintenance, handovers, and asset sets
- A 16-report management centre with safe Excel and CSV exports
- Complete versioned JSON backups
- Admin, Super Admin, and Teacher roles

Existing records are migrated automatically to the IT register with individual tracking.

## Classroom Browser

- Open **Classrooms** from the navigation to browse rooms without generating a report.
- Each classroom shows separate **IT Assets** and **Classroom Assets** lists.
- In **Admin > Locations**, create a classroom or edit an existing location and change its type to **Classroom**.
- Assets remain in their original register; `location_id` only controls which classroom displays them.
- Registering an asset from a classroom page preselects that room.

## Report Centre

The administrator-only Report Centre includes:

- Executive multi-sheet management pack
- Complete register, classroom inventory, and stocktake-by-location sheets
- Condition, damage, missing-item, and data-quality exception reports
- Recorded purchase value, warranty expiry, and age-based replacement planning
- Active allocations, overdue returns, and complete allocation history
- Maintenance, requests, class sets, and handover reconciliation

Reports can be filtered by register, asset type, status, condition, location, current holder, and activity date. Export filters are recorded in Excel workbooks, exports are not cached, and user-entered text is neutralized to prevent spreadsheet formula injection.

Recorded value reports use purchase-cost data and are not depreciation schedules. Replacement reports use a configurable planning lifecycle and must be reviewed against the school's approved accounting and asset-management policies.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.local.example` to `.env.local` and set the required values.
3. Run `npm run seed` only when creating a new development database.
4. Start the app with `npm run dev`.

Required environment variables:

```env
JWT_SECRET=at-least-32-random-characters
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
```

Email notifications are optional and use `RESEND_API_KEY` and `FROM_EMAIL`.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

## Tracking Policy

- Use individual tracking for assets with a serial number, warranty, meaningful value, or unique maintenance history.
- Use quantity tracking for groups of interchangeable classroom items in one location.
- Smartboards remain in the IT register.
- A quantity record's condition counts must always equal its total quantity.

## Database

The application uses Turso, a hosted SQLite-compatible database. Schema upgrades run automatically and preserve existing records.
