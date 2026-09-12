# Requires the NVIDIA Container Toolkit on the Docker host to actually use the GPU
# (otherwise Bark falls back to CPU, which is very slow — see README.md).
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

COPY server.py ./

ENV BARK_SERVER_PORT=8882
EXPOSE 8882

CMD ["python3", "server.py"]
