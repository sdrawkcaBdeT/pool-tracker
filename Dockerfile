FROM node:22-alpine AS ui-builder

WORKDIR /ui
COPY ui/vite-project/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY ui/vite-project/ ./
RUN npm run build

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    STATIC_DIR=/app/server/app/static \
    DATA_DIR=/app/data/raw

WORKDIR /app
COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

COPY server ./server
COPY data/raw ./data/raw
COPY --from=ui-builder /ui/dist ./server/app/static

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--app-dir", "server", "--host", "0.0.0.0", "--port", "8000"]
