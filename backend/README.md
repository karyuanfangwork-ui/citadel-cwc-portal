# Enterprise Help Center - Backend

Backend API for the Enterprise Help Center application, providing service management for IT Support, HR Services, and Group Finance departments.

## 🚀 Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL 15+ (via Prisma ORM)
- **Cache**: Redis 7+
- **Search**: Elasticsearch 8+
- **Storage**: AWS S3 / SeaweedFS (local development)
- **Authentication**: JWT + Passport.js
- **Validation**: Zod

## 📋 Prerequisites

- Node.js 20 or higher
- PostgreSQL 15 or higher
- Redis 7 or higher (optional for development)
- Docker & Docker Compose (recommended for local development)

## 🛠️ Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Start all services (PostgreSQL, Redis, ClamAV, SeaweedFS S3, Mailhog)
docker-compose up -d

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed the database with initial data
npm run prisma:seed

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000`

### Option 2: Manual Setup

1. **Install PostgreSQL and Redis**
2. **Create database**: `createdb help_center`
3. **Install dependencies**: `npm install`
4. **Configure environment**: `cp .env.example .env` and update values
5. **Set up Prisma**: `npm run prisma:generate && npm run prisma:migrate`
6. **Seed database**: `npm run prisma:seed`
7. **Start server**: `npm run dev`

## 📚 Available Scripts

```bash
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm start                # Start production server
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio (database GUI)
npm run prisma:seed      # Seed database with initial data
npm test                 # Run tests
npm run lint             # Lint code
npm run format           # Format code with Prettier
```

## 🗄️ Database Schema

The database includes 20+ tables covering:

- **Users & Auth**: Users, roles, permissions, sessions
- **Service Management**: Service desks, categories, request types, requests
- **Communication**: Activities, attachments, notifications
- **Department-Specific**: IT hardware, HR leave, Finance expenses
- **Knowledge Base**: Articles and documentation
- **Audit**: Complete audit trail

See [PRISMA_SETUP.md](./PRISMA_SETUP.md) for detailed schema documentation.

## 🔑 Default Credentials

After seeding the database:

**Admin User**
- Email: `admin@helpdesk.com`
- Password: `admin123`

**Test Users**
- Email: `john.doe@company.com` / `jane.smith@company.com` / `agent@helpdesk.com`
- Password: `password123`

⚠️ **Change these credentials in production!**

## 🌐 API Endpoints

### Authentication
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
```

### Requests
```
GET    /api/v1/requests
POST   /api/v1/requests
GET    /api/v1/requests/:id
PUT    /api/v1/requests/:id
DELETE /api/v1/requests/:id
```

### Users
```
GET    /api/v1/users/me
PUT    /api/v1/users/me
```

See full API documentation in [API.md](./docs/API.md) (coming soon)

## 🐳 Docker Services

When using `docker-compose up`, the following services are available:

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Main database |
| Redis | 6379 | Cache & sessions |
| SeaweedFS S3 | 8333 (127.0.0.1 only) | Persistent S3-compatible storage |
| Mailhog SMTP | 1025 | Email testing (SMTP) |
| Mailhog UI | 8025 | Email testing (Web UI) |

### Local S3-compatible storage

The official open-source `chrislusf/seaweedfs:4.51` image runs `weed mini` with a
dedicated `seaweedfs_data` volume. It seeds `helpdesk-uploads` idempotently from
`S3_BUCKET` and local-only credentials from `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY`. See the [official mini guide](https://github.com/seaweedfs/seaweedfs/wiki/Quick-Start-with-weed-mini).

From `backend/`, start storage alone without recreating the database or Redis:

```sh
docker compose up -d seaweedfs
docker compose ps seaweedfs
node scripts/verify-local-s3.cjs
npx tsx scripts/verify-local-crm-storage.ts
```

Set local `.env` to `S3_ENDPOINT=http://localhost:8333`, `S3_REGION=us-east-1`,
`S3_BUCKET=helpdesk-uploads`, `S3_ACCESS_KEY=cwc-local`,
`S3_SECRET_KEY=cwc-local-development-only`, and `S3_FORCE_PATH_STYLE=true`.
Restart the local backend after editing `.env`. These credentials are development
fixtures only. Only the S3 port is published, bound to loopback; internal admin,
filer, and volume ports are not published. The healthcheck checks master readiness;
the verification script also checks authenticated bucket and object operations.

LocalStack's obsolete init hook has been removed after confirming its only consumer
was the replaced local service. Existing LocalStack volumes are retained, and their
objects are not automatically migrated. Do not use `docker compose down -v` to
switch storage. Production continues to use separately supplied S3/Spaces settings.
No migration is run by storage setup. CRM account-document end-to-end verification
requires the account-document table to already exist in the local database.

The CRM verification script creates dedicated `[TEST]` account/lead records,
checks document list/download byte equality and account soft deletion through the
existing services, then removes only its own randomly identified fixtures and
objects. It does not exercise browser UI or HTTP authentication. Verified locally:
SeaweedFS remained healthy, bucket access and object upload/download/delete passed,
and both account and lead document service flows passed without applying migrations.

### Access Mailhog (Email Testing)
- URL: http://localhost:8025
- All emails sent by the app will appear here

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Database seeding script
│   └── migrations/        # Database migrations
├── src/
│   ├── config/            # Configuration files
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript types
│   └── index.ts           # Application entry point
├── .env.example           # Environment variables template
├── docker-compose.yml     # Docker services configuration
├── package.json           # Dependencies and scripts
└── tsconfig.json          # TypeScript configuration
```

## 🔒 Security Features

- ✅ JWT-based authentication with refresh tokens
- ✅ Password hashing with bcrypt
- ✅ Role-based access control (RBAC)
- ✅ Rate limiting
- ✅ Helmet.js security headers
- ✅ CORS configuration
- ✅ Input validation with Zod
- ✅ SQL injection protection (Prisma)
- ✅ XSS protection

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📊 Monitoring & Logging

- **Logging**: Winston (JSON format in production)
- **Request Logging**: Morgan middleware
- **Error Tracking**: (Configure Sentry in production)

## 🚀 Production Deployment

1. Set environment variables (especially `DATABASE_URL`, `JWT_SECRET`)
2. Build the application: `npm run build`
3. Run migrations: `npm run prisma:migrate:prod`
4. Start the server: `npm start`

### Environment Variables for Production

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379
JWT_SECRET=your-super-secret-key
S3_ENDPOINT=https://your-s3-endpoint
S3_REGION=your-region
S3_BUCKET=your-bucket
S3_ACCESS_KEY=your-key
S3_SECRET_KEY=your-secret
S3_FORCE_PATH_STYLE=false
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## 📝 License

MIT

## 📞 Support

For issues and questions, please open an issue on GitHub or contact the development team.
