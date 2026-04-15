# AI Task Platform

MERN + Python Worker + Redis + Docker + Kubernetes

## Quick Start (Docker Compose)

```bash
# 1. Copy and fill in secrets
cp backend/.env.example backend/.env

# 2. Start everything
docker compose up --build

# Frontend: http://localhost
# Backend:  http://localhost:5000
```

## Project Structure

```
ai-task-platform/
├── backend/          Node.js + Express API
│   └── src/
│       ├── config/   db.js, redis.js
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       └── routes/
├── frontend/         React + Vite + Tailwind
│   └── src/
│       ├── api/
│       ├── components/
│       ├── context/
│       └── pages/
├── worker/           Python Redis queue consumer
├── k8s/              Kubernetes manifests
├── .github/workflows CI/CD pipeline
└── ARCHITECTURE.md   Scaling & design decisions
```

## Kubernetes Deploy (k3s)

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
# Edit k8s/secret.yaml with real base64 values first
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/
```

## GitHub Actions Secrets Required

| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

## Environment Variables

See `backend/.env.example` for all required variables.
