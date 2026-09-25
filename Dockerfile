# ===================================================
# Stage 1: Build React Frontend
# ===================================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ===================================================
# Stage 2: Python Backend & Static Server
# ===================================================
FROM python:3.12-slim AS runner
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python packages
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code, migrations, and alembic config
COPY backend/ ./backend/
COPY migrations/ ./migrations/
COPY alembic.ini ./

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

# Run migrations and start server
CMD ["sh", "-c", "python -m alembic upgrade head && python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000"]
