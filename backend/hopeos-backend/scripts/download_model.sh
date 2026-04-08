#!/bin/bash
# Download Gemma 4 GGUF models for HopeOS AI

MODEL_DIR="../models"
mkdir -p "$MODEL_DIR"

echo "=== HopeOS AI Model Downloader ==="
echo ""
echo "This will download Gemma 4 E2B (multimodal) GGUF files."
echo "Total download size: ~3-5 GB depending on quantization"
echo ""

# Check if huggingface-cli is available
if ! command -v huggingface-cli &> /dev/null; then
    echo "Installing huggingface_hub..."
    pip install huggingface_hub
fi

echo "Downloading Gemma 4 E2B multimodal model..."
echo ""

# Download the main model (Q4_K_M quantization - good balance of speed/quality)
echo "1/2: Downloading main model (Q4_K_M)..."
huggingface-cli download ggml-org/gemma-4-E2B-it-GGUF \
    gemma-4-e2b-it-Q4_K_M.gguf \
    --local-dir "$MODEL_DIR" \
    --local-dir-use-symlinks False

# Download the multimodal projector (required for image analysis)
echo "2/2: Downloading multimodal projector..."
huggingface-cli download ggml-org/gemma-4-E2B-it-GGUF \
    mmproj-gemma-4-e2b-it-f16.gguf \
    --local-dir "$MODEL_DIR" \
    --local-dir-use-symlinks False

echo ""
echo "=== Download Complete ==="
echo ""
echo "Model files saved to: $MODEL_DIR"
echo ""
echo "To use a different quantization, available options:"
echo "  - gemma-4-e2b-it-Q2_K.gguf    (smallest, fastest, lower quality)"
echo "  - gemma-4-e2b-it-Q4_K_M.gguf  (recommended balance)"
echo "  - gemma-4-e2b-it-Q5_K_M.gguf  (higher quality)"
echo "  - gemma-4-e2b-it-Q6_K.gguf    (best quality, slower)"
echo "  - gemma-4-e2b-it-Q8_0.gguf    (highest quality)"
echo ""
echo "Set MODEL_DIR and LLM_MODEL environment variables to customize:"
echo "  export MODEL_DIR=/path/to/models"
echo "  export LLM_MODEL=gemma-4-e2b-it-Q5_K_M.gguf"
