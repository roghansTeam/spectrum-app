FROM python:3.12-slim

WORKDIR /app

# Зависимости (отдельным слоем для кэша)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Код
COPY . .

# Непривилегированный юзер + persistent volume для events / SQLite
RUN useradd -m -u 1000 spectrum \
    && mkdir -p /data \
    && chown -R spectrum:spectrum /app /data
USER spectrum

ENV DATA_PATH=/data
# Unbuffered stdout so fly logs see TG bot startup messages in real time
ENV PYTHONUNBUFFERED=1

CMD ["python", "bot.py"]
