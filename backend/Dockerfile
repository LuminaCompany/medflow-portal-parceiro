FROM python:3.11-slim

WORKDIR /app

# Dependências primeiro (cache de camada)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# EasyPanel faz proxy + HTTPS; container persistente mantém o cache TTL em processo.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
