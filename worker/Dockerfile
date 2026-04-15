# ---- build stage ----
FROM python:3.12-slim AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- runtime stage ----
FROM python:3.12-slim AS runtime
RUN useradd -m -u 1001 appuser
WORKDIR /app
COPY --from=build /install /usr/local
COPY worker.py .
USER appuser
CMD ["python", "-u", "worker.py"]
