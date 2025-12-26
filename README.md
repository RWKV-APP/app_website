# App Website

A monorepo project for app website with backend and frontend.

## Project Structure

```
app_website/
├── backend/          # NestJS backend
├── frontend/         # Next.js frontend
└── package.json      # Root package.json for workspace
```

## Tech Stack

### Backend

- NestJS
- Prisma
- TypeScript
- SQLite

### Frontend

- Next.js
- Jotai
- React
- TypeScript

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

```bash
# Run backend
pnpm dev:backend

# Run frontend
pnpm dev:frontend
```

### Build

```bash
# Build all
pnpm build

# Build backend only
pnpm build:backend

# Build frontend only
pnpm build:frontend
```

## Backend Setup

1. Copy `.env.example` to `.env` in the backend directory
2. Run Prisma migrations:
   ```bash
   cd backend
   pnpm prisma:migrate
   ```
3. Generate Prisma client:
   ```bash
   pnpm prisma:generate
   ```

## Frontend Setup

The frontend is a Next.js application. Just run `pnpm dev:frontend` to start development server.
