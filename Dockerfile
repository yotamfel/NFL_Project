# Stage 1: build the React frontend
FROM node:20-slim AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Python runtime (no Node.js — smaller image)
FROM python:3.11-slim
WORKDIR /app

COPY server/requirements.txt ./server/
RUN pip install --no-cache-dir -r server/requirements.txt

# Backend code + pre-trained ML model
COPY server/ ./server/

# Built frontend assets from stage 1
COPY --from=frontend /app/client/dist ./client/dist

EXPOSE 8000
CMD ["sh", "-c", "cd server && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
