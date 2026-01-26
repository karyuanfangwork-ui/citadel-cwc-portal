# Enterprise Help Center

A modern, full-stack service desk management system supporting IT Support, HR Services, and Group Finance operations.

## 🚀 Features

- **Multi-Service Desk Support**: IT, HR, and Finance
- **Dynamic Forms**: Admin-configurable custom fields
- **Request Type Selector**: Visual card-based service selection
- **File Uploads**: Support for attachments and screenshots
- **Role-Based Access**: Admin, Agent, and End-User roles
- **Real-time Search**: Knowledge base integration
- **Responsive Design**: Mobile-friendly interface

## 🏗️ Tech Stack

### Backend
- **Node.js** + **Express.js**
- **TypeScript**
- **Prisma ORM** (PostgreSQL)
- **JWT Authentication**
- **Express Rate Limiting**

### Frontend
- **React 18** + **TypeScript**
- **Vite**
- **React Router v6**
- **Axios**

## 📦 Project Structure

```
enterprise-help-center/
├── backend/          # Express API server
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── config/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── package.json
│
├── frontend/         # React application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   ├── pages/
│   └── package.json
│
└── README.md
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Git

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables in `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/help_center"
   JWT_SECRET="your-secret-key"
   PORT=3000
   ```

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

6. Seed the database:
   ```bash
   npx prisma db seed
   ```

7. Start development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Configure API URL in `.env`:
   ```env
   VITE_API_URL=http://localhost:3000/api/v1
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

6. Open browser to `http://localhost:5173`

## 👤 Default Users

After seeding, you can log in with:

**Admin:**
- Email: `admin@helpdesk.com`
- Password: `admin123`

**Agent:**
- Email: `agent@helpdesk.com`
- Password: `agent123`

**End User:**
- Email: `user@helpdesk.com`
- Password: `user123`

## 📚 Service Desks

### IT Support (5 categories)
- Get IT help
- Email Management (4 request types)
- Report System problem
- Request Software Installation
- Request new hardware

### HR Services (4 categories)
- New Hiring Request
- Report an HR issue
- Onboarding a new hire
- Offboard an Employee

### Group Finance (3 categories)
- Purchase Requisition
- Inter-Company Chargeback
- Submit Budget Proposal

## 🔐 Security Features

- JWT-based authentication
- Rate limiting (configurable)
- Password hashing (bcrypt)
- CORS protection
- Input validation
- SQL injection prevention (Prisma)

## 📝 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 📧 Support

For issues and questions, please open a GitHub issue.
