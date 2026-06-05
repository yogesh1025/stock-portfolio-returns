FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
COPY templates ./templates
EXPOSE 8000
CMD ["gunicorn","--bind","0.0.0.0:8000","--workers","2","--threads","4","--timeout","120","app:app"]
