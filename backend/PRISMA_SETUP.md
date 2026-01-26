# Prisma Database Setup Guide

## Prerequisites

- Node.js 20+ installed
- PostgreSQL 15+ running
- Redis running (optional for development)

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and update the DATABASE_URL
# Example: DATABASE_URL="postgresql://postgres:password@localhost:5432/help_center?schema=public"
```

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Run Database Migrations

```bash
# For development (creates migration files)
npm run prisma:migrate

# For production (applies migrations without prompts)
npm run prisma:migrate:prod
```

### 5. Seed the Database

```bash
npm run prisma:seed
```

This will create:
- ✅ Service Desks (IT, HR, Finance)
- ✅ Roles (Admin, Agent, User)
- ✅ Permissions
- ✅ Admin user (email: admin@helpdesk.com, password: admin123)
- ✅ Test users (password: password123)
- ✅ Service categories
- ✅ Notification templates

### 6. Open Prisma Studio (Optional)

```bash
npm run prisma:studio
```

This opens a visual database browser at http://localhost:5555

## Common Commands

```bash
# Generate Prisma Client after schema changes
npm run prisma:generate

# Create a new migration
npm run prisma:migrate

# Apply migrations in production
npm run prisma:migrate:prod

# Reset database (WARNING: deletes all data)
npm run prisma:reset

# Open Prisma Studio
npm run prisma:studio

# Seed database
npm run prisma:seed
```

## Database Schema Overview

### Core Tables

- **users** - User accounts and profiles
- **roles** - User roles (Admin, Agent, User)
- **permissions** - Granular permissions
- **sessions** - User sessions and tokens

### Service Management

- **service_desks** - IT, HR, Finance departments
- **service_categories** - Categories within each desk
- **request_types** - Specific request types
- **requests** - Main ticket/request table

### Communication

- **request_activities** - Timeline of updates/comments
- **request_attachments** - File uploads
- **notifications** - Email/SMS/Push notifications

### Department-Specific

- **it_hardware_requests** - IT hardware orders
- **hr_leave_requests** - Leave applications
- **finance_expense_reimbursements** - Expense claims
- **expense_line_items** - Individual expense items

### Knowledge Base

- **kb_articles** - Help articles and documentation

### Audit

- **audit_logs** - Complete audit trail

## Troubleshooting

### Migration Issues

If you encounter migration errors:

```bash
# Reset the database (WARNING: deletes all data)
npm run prisma:reset

# Or manually drop and recreate
dropdb help_center
createdb help_center
npm run prisma:migrate
```

### Connection Issues

Check your DATABASE_URL in `.env`:
- Ensure PostgreSQL is running
- Verify credentials
- Check database name exists

### Prisma Client Not Found

```bash
npm run prisma:generate
```

## Production Deployment

1. Set `DATABASE_URL` in production environment
2. Run migrations: `npm run prisma:migrate:prod`
3. Generate client: `npm run prisma:generate`
4. DO NOT run seed in production (unless intentional)

## Next Steps

After setting up the database:

1. Start the development server: `npm run dev`
2. Test API endpoints
3. Integrate with frontend
4. Set up Redis for caching
5. Configure Elasticsearch for search
6. Set up S3 for file storage
