# Cloudflare Workers Deployment Instructions

## Prerequisites
- Cloudflare account
- Node.js installed
- Wrangler CLI

## Setup Steps

### 1. Install Dependencies
```bash
# Frontend
npm install

# Worker
cd worker
npm install
```

### 2. Setup Cloudflare D1 Database
```bash
cd worker
npx wrangler d1 create crownzcom-db
```

Copy the database ID from the output and update `wrangler.toml`

### 3. Initialize Database Schema
```bash
npx wrangler d1 execute crownzcom-db --file=schema.sql
```

### 4. Deploy Worker
```bash
npx wrangler deploy
```

### 5. Update Frontend Environment
Create `.env` file with your worker URL:
```
VITE_API_URL=https://your-worker.your-subdomain.workers.dev
```

### 6. Build and Deploy Frontend
```bash
npm run build
```

## Default Admin Account
- Email: crownzcom@gmail.com
- Password: admin123

## Features
✅ Email/password authentication
✅ JWT tokens for session management
✅ Cloudflare D1 database
✅ User roles (member/admin)
✅ Registration and login forms
✅ Secure password hashing
✅ CORS handling
✅ Token validation