-- Postgres init: extensions only. All schema is owned by Prisma migrations.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
