# Requires the NVIDIA Container Toolkit on the Docker host to actually use the GPU
# (otherwise Bark falls back to CPU, which is very slow — see README.md).
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
# setuptools 59.6 (fourni par Ubuntu 22.04) ne lit pas correctement la table
# [project] du pyproject.toml de Bark (PEP 621), et pip retombe silencieusement
# sur son setup.py vide -> package "UNKNOWN" sans aucune dependance installee.
RUN pip3 install --no-cache-dir --upgrade pip setuptools wheel \
    && pip3 install --no-cache-dir -r requirements.txt

COPY server.py ./

ENV BARK_SERVER_PORT=8882
EXPOSE 8882

CMD ["python3", "server.py"]
