# AI Task Platform — Architecture Document

## System Overview

```
Browser → Nginx (frontend) → Express API (backend) → MongoDB
                                      ↓
                                 Redis Queue
                                      ↓
                            Python Workers (N replicas)
                                      ↓
                                  MongoDB
```

---

## Worker Scaling Strategy

Workers are stateless consumers of the Redis queue. Scaling is horizontal:

- Each worker runs an infinite polling loop using `BRPOPLPUSH` — atomic, no duplicate processing.
- In Kubernetes, increase `replicas` in `worker-deployment.yaml`. No code changes needed.
- For 100k tasks/day (~1.15 tasks/sec average, with spikes up to 10x):
  - 3–5 worker replicas handle normal load comfortably.
  - Use a Horizontal Pod Autoscaler (HPA) keyed on a custom Redis queue-depth metric (via Prometheus + kube-metrics-adapter) to auto-scale during spikes.
  - Each worker processes one job at a time; for CPU-bound ops, this is safe and predictable.

```yaml
# HPA example (add to k8s/)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-hpa
  namespace: aitask
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: External
      external:
        metric:
          name: redis_queue_depth
        target:
          type: AverageValue
          averageValue: "50"
```

---

## Handling 100k Tasks/Day

| Concern | Solution |
|---|---|
| Queue throughput | Redis handles >100k ops/sec; queue depth is negligible |
| Worker throughput | 3 workers × ~5 tasks/sec = 15 tasks/sec = 1.3M tasks/day headroom |
| DB write pressure | Bulk log writes; index on `userId + createdAt` keeps reads fast |
| API rate limiting | 200 req/15min per IP; adjust for authenticated users if needed |
| Job deduplication | Bull uses `jobId = taskId`, preventing duplicate queue entries |

---

## MongoDB Indexing Strategy

```js
// Applied in Task model
taskSchema.index({ userId: 1, createdAt: -1 });  // dashboard list query
taskSchema.index({ userId: 1, status: 1 });       // status filter
taskSchema.index({ status: 1 });                  // worker/admin queries
```

- `_id` is indexed by default (used for single task fetch and worker updates).
- Avoid indexing `logs` or `result` — they are write-heavy and not queried directly.
- For 100k+ tasks, consider TTL index to auto-expire old completed tasks:

```js
taskSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 }); // 30 days
```

---

## Redis Failure Handling

| Scenario | Behavior |
|---|---|
| Redis temporarily down | Worker retries connection every 5s (loop catch block). Backend returns 500 on queue push failure. |
| Job lost mid-processing | `BRPOPLPUSH` moves job to `active` list atomically. On worker crash, job stays in `active`. A separate reaper job (cron) can re-queue stale active jobs. |
| Redis restart | Jobs in `wait` list persist if Redis AOF/RDB persistence is enabled (configured in docker-compose). |
| Full Redis failure | Tasks remain in MongoDB with `pending` status. Operator can re-queue them manually or via a recovery script. |

For production, use Redis Sentinel or Redis Cluster for HA. In k3s, deploy Redis with a PersistentVolumeClaim.

---

## Staging vs Production Deployment

### Staging
- Single replica per service
- `docker-compose.yml` or a dedicated k8s namespace (`aitask-staging`)
- Shared MongoDB instance with a separate database name
- Relaxed rate limits
- Debug logging enabled

### Production
- Multi-replica backend (2+) and worker (3+) with HPA
- MongoDB Atlas or self-hosted replica set (3 nodes) for HA
- Redis Sentinel or Elasticache for HA
- TLS termination at Ingress (cert-manager + Let's Encrypt)
- Secrets managed via Kubernetes Secrets or HashiCorp Vault
- Structured JSON logging → forwarded to CloudWatch / Datadog / Loki
- Resource limits enforced on all pods
- Network policies restricting pod-to-pod traffic

```
Staging:  feature-branch → staging namespace → smoke tests → merge to main
Production: main → CI builds images → updates k8s manifests → ArgoCD syncs cluster
```

---

## Security Checklist

- [x] JWT with expiry, verified on every protected route
- [x] bcrypt password hashing (cost factor 12)
- [x] Helmet sets secure HTTP headers
- [x] express-mongo-sanitize prevents NoSQL injection
- [x] Rate limiting on all `/api/` routes
- [x] Non-root container users in all Dockerfiles
- [x] No secrets in source code — all via env vars / k8s Secrets
- [x] Input size limited to 10kb on Express JSON parser
