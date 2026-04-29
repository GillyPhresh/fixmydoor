# FixMyDoor - Door & Furniture Repair Booking System

A professional booking management system for door and furniture repair services.

## Features

- 🏠 Professional booking form with validation
- 👨‍💼 Secure admin dashboard with authentication
- 🔍 Search and filter bookings
- 📊 Status management (Pending → Confirmed → In Progress → Completed)
- 📱 Mobile-responsive design
- 🔒 Session-based authentication
- 💾 SQLite database with Prisma ORM

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: Prisma + SQLite
- **Styling**: Tailwind CSS + Radix UI
- **Forms**: React Hook Form + Zod validation

## Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate

# Start development server
pnpm dev
```

## Production Deployment

This app is configured for deployment on **Railway** (recommended) or similar Node.js hosting platforms.

### Environment Variables

Create a `.env` file in production:

```env
DATABASE_URL="file:./prisma/prod.db"
SESSION_SECRET="your-secure-random-session-secret-here"
NODE_ENV="production"
```

### Build & Start

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Admin Access

Default admin credentials:
- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Important**: Change the default password in production!

## API Endpoints

- `POST /api/bookings` - Submit booking
- `GET /api/bookings` - Get bookings (admin only)
- `PATCH /api/bookings/:id` - Update booking status (admin only)
- `DELETE /api/bookings/:id` - Delete booking (admin only)
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/status` - Check auth status

## Database

The app uses SQLite with Prisma ORM. Database file is automatically created on first run.

## License

MIT