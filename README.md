# MPS School Asset Register

Asset management for Macfarlane Primary School, with separate registers for IT equipment and classroom assets.

## Features

- Separate IT and classroom asset registers
- Individual tracking for devices, smartboards, fridges, and valuable equipment
- Quantity tracking for chairs, tables, desks, and other grouped classroom items
- Good, fair, damaged, and missing condition counts
- QR labels, allocation history, requests, maintenance, handovers, and asset sets
- Excel reports filtered by register, category, status, and teacher
- Complete versioned JSON backups
- Admin, Super Admin, and Teacher roles

Existing records are migrated automatically to the IT register with individual tracking.

## Classroom Browser

- Open **Classrooms** from the navigation to browse rooms without generating a report.
- Each classroom shows separate **IT Assets** and **Classroom Assets** lists.
- In **Admin > Locations**, create a classroom or edit an existing location and change its type to **Classroom**.
- Assets remain in their original register; `location_id` only controls which classroom displays them.
- Registering an asset from a classroom page preselects that room.

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
