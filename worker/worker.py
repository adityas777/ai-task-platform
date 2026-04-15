"""
Python RQ worker that processes tasks from the Redis 'task-processing' queue.
Compatible with Bull queue job format (JSON payload).
"""
import os
import json
import time
import logging
from datetime import datetime, timezone

import redis
from pymongo import MongoClient
from bson import ObjectId

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD") or None
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/aitasks")
QUEUE_NAME = "bull:task-processing"  # Bull stores jobs under this key pattern

# ── Connections ───────────────────────────────────────────────────────────────
def get_redis():
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        decode_responses=True,
    )

def get_db():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    return client["aitasks"]

# ── Operations ────────────────────────────────────────────────────────────────
def process_operation(input_text: str, operation: str) -> str:
    ops = {
        "uppercase": lambda t: t.upper(),
        "lowercase": lambda t: t.lower(),
        "reverse": lambda t: t[::-1],
        "wordcount": lambda t: str(len(t.split())),
    }
    fn = ops.get(operation)
    if fn is None:
        raise ValueError(f"Unknown operation: {operation}")
    return fn(input_text)

# ── Task lifecycle helpers ────────────────────────────────────────────────────
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def append_log(db, task_id: str, message: str):
    db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$push": {"logs": {"message": message, "timestamp": now_iso()}}},
    )

def set_status(db, task_id: str, status: str, result=None):
    update = {"$set": {"status": status}}
    if result is not None:
        update["$set"]["result"] = result
    db.tasks.update_one({"_id": ObjectId(task_id)}, update)

# ── Job processing ────────────────────────────────────────────────────────────
def handle_job(db, job_data: dict):
    task_id = job_data.get("taskId")
    input_text = job_data.get("inputText", "")
    operation = job_data.get("operation", "")

    log.info("Processing task %s | op=%s", task_id, operation)

    set_status(db, task_id, "running")
    append_log(db, task_id, f"Worker picked up job at {now_iso()}")

    try:
        result = process_operation(input_text, operation)
        append_log(db, task_id, f"Operation '{operation}' completed successfully")
        set_status(db, task_id, "success", result)
        log.info("Task %s succeeded", task_id)
    except Exception as exc:
        err_msg = str(exc)
        append_log(db, task_id, f"Error: {err_msg}")
        set_status(db, task_id, "failed", err_msg)
        log.error("Task %s failed: %s", task_id, err_msg)

# ── Bull queue polling ────────────────────────────────────────────────────────
def poll_queue(r, db):
    """
    Bull stores waiting jobs in a list: bull:<queue>:wait
    We BRPOPLPUSH to atomically move a job to the active list.
    """
    wait_key = f"bull:task-processing:wait"
    active_key = f"bull:task-processing:active"

    log.info("Worker started. Polling queue '%s'...", wait_key)

    while True:
        try:
            # Block for up to 5 seconds waiting for a job
            job_id = r.brpoplpush(wait_key, active_key, timeout=5)
            if job_id is None:
                continue

            job_key = f"bull:task-processing:{job_id}"
            raw = r.hget(job_key, "data")
            if raw is None:
                log.warning("Job %s has no data, skipping", job_id)
                r.lrem(active_key, 1, job_id)
                continue

            job_data = json.loads(raw)
            handle_job(db, job_data)

            # Mark job complete in Bull
            r.lrem(active_key, 1, job_id)
            completed_key = f"bull:task-processing:completed"
            r.lpush(completed_key, job_id)
            r.ltrim(completed_key, 0, 99)  # keep last 100

        except redis.exceptions.ConnectionError as exc:
            log.error("Redis connection lost: %s — retrying in 5s", exc)
            time.sleep(5)
        except Exception as exc:
            log.exception("Unexpected error: %s", exc)
            time.sleep(1)

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    r = get_redis()
    db = get_db()
    poll_queue(r, db)
