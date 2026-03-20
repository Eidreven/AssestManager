# MPS Asset Manager

Technology asset management system for **Macfarlane Primary School**.

## Features

- **Register assets** (iPads, laptops, Chromebooks, projectors, etc.)
- **QR code generation** – scan to view device details instantly
- **Allocation tracking** – who has what device, since when, and where
- **Request system** – staff can request to borrow or relocate a device
- **Allocation logs** – full history of every device
- **Role-based access** – Admin and Staff roles
- **Mobile-friendly** – designed for QR scanning on phones

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Seed the database (creates admin user + sample data)

```bash
npm run seed
```

**Default credentials:**
- Admin: `admin@macfarlane.sch` / `admin1234`
- Staff: `teacher@macfarlane.sch` / `teacher1234`

> **Change these passwords immediately in a production environment.**

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Production build

```bash
npm run build
npm start
```

---

## QR Code Workflow

1. Register an asset in the system (**Admin → Assets → Register Asset**)
2. On the asset detail page, click **"Print QR Label"** or **"Download QR"**
3. Print the label and stick it on the device
4. Anyone can scan the QR code with their phone — they'll be prompted to log in, then shown full device details
5. Staff can submit **Borrow** or **Relocation** requests directly from the scan page
6. Admins review and approve/reject requests from the **Requests** page

---

## Environment Variables

Create a `.env.local` file to override defaults:

```env
JWT_SECRET=your-very-secure-secret-here
```

---

## Project Structure

```
├── app/
│   ├── dashboard/          # Overview with stats
│   ├── assets/             # Assets list + register new
│   ├── asset/[id]/         # Asset detail (QR scan lands here)
│   │   └── qr/             # Printable QR label page
│   ├── logs/               # Full allocation history
│   ├── requests/           # Admin request management
│   ├── admin/              # Locations & user management
│   └── api/                # REST API routes
├── lib/
│   ├── db.ts               # SQLite database layer
│   └── auth.ts             # JWT authentication
├── components/
│   ├── Navbar.tsx
│   └── AppShell.tsx
├── data/                   # SQLite database file (auto-created)
└── scripts/
    └── seed.mjs            # Database seeder
```
