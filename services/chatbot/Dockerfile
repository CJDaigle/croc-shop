FROM python:3.11-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN addgroup --system appuser && adduser --system --ingroup appuser appuser
USER appuser

EXPOSE 3005

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3005"]
