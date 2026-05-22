# Single-stage image — builds whisper.cpp from source so we don't depend on
# external prebuilt binaries. Final image is ~700MB, dominated by build tools
# we retain to allow native rebuilds (better-sqlite3) if ever needed at runtime.
# Multi-stage trim is a TODO if image size becomes an issue.
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    WHISPER_BIN_PATH=/usr/local/bin/whisper-cli \
    WHISPER_MODEL_PATH=/app/models/ggml-tiny.en.bin \
    CLIPS_DIR=/app/clips \
    DATA_DIR=/app/data

RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        build-essential \
        cmake \
        git \
        curl \
        ca-certificates \
        python3 \
    && rm -rf /var/lib/apt/lists/*

# Build whisper.cpp from source and install the CLI binary
RUN git clone --depth=1 https://github.com/ggerganov/whisper.cpp /tmp/whisper.cpp \
    && cd /tmp/whisper.cpp \
    && cmake -B build -DGGML_NATIVE=OFF -DWHISPER_BUILD_EXAMPLES=ON -DWHISPER_BUILD_TESTS=OFF \
    && cmake --build build --config Release -j "$(nproc)" \
    && cp build/bin/whisper-cli /usr/local/bin/whisper-cli \
    && rm -rf /tmp/whisper.cpp

WORKDIR /app

# Install all deps (incl. dev) so tsc can build, then prune to prod.
# --include=dev is required because NODE_ENV=production (set above) would
# otherwise cause npm ci to skip devDependencies, breaking the build step.
COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build && npm prune --omit=dev

# Pre-download the whisper model into the image
RUN mkdir -p models \
    && curl -fL -o models/ggml-tiny.en.bin \
       https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin

# sqlite cooldown DB lives here — mount a volume to persist across restarts
VOLUME ["/app/data"]

CMD ["node", "dist/main.js"]
