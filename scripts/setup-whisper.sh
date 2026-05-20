#!/usr/bin/env bash
# One-time setup for whisper.cpp:
# 1. Verify the whisper-cli binary is on PATH (install via `brew install whisper-cpp`)
# 2. Download the ggml-tiny.en model into ./models/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_DIR="$ROOT/models"
MODEL_NAME="ggml-tiny.en.bin"
MODEL_PATH="$MODELS_DIR/$MODEL_NAME"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODEL_NAME"

if ! command -v whisper-cli >/dev/null 2>&1; then
  echo "whisper-cli not found on PATH."
  echo "Install via: brew install whisper-cpp"
  exit 1
fi

echo "whisper-cli: $(command -v whisper-cli)"

if [[ -f "$MODEL_PATH" ]]; then
  echo "model already present: $MODEL_PATH"
  exit 0
fi

mkdir -p "$MODELS_DIR"
echo "downloading $MODEL_NAME (~75MB)..."
curl -L --fail --progress-bar -o "$MODEL_PATH" "$MODEL_URL"

# Sanity check: file is > 50MB
size=$(stat -f%z "$MODEL_PATH" 2>/dev/null || stat -c%s "$MODEL_PATH")
if [[ $size -lt 50000000 ]]; then
  echo "downloaded file is too small ($size bytes); something went wrong"
  rm -f "$MODEL_PATH"
  exit 1
fi

echo "model ready: $MODEL_PATH ($size bytes)"
