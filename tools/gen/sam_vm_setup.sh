#!/usr/bin/env bash
# Setup script for the gpu-sam3-a100 SAM segmentation VM.
# Installs system deps, creates a pinned venv, downloads models.
# Usage: bash tools/gen/sam_vm_setup.sh [zone]
set -euo pipefail

ZONE="${1:-us-central1-a}"
VM="gpu-sam3-a100"

echo "=== Installing system packages ==="
gcloud compute ssh "$VM" --zone "$ZONE" --command \
  "sudo apt-get update -qq && sudo apt-get install -y python3-venv python3-pip"

echo "=== Creating venv + installing Python deps ==="
gcloud compute ssh "$VM" --zone "$ZONE" --command \
  "python3 -m venv ~/sam3_venv && \
   ~/sam3_venv/bin/pip install --upgrade pip && \
   ~/sam3_venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cu129 && \
   ~/sam3_venv/bin/pip install 'numpy<2' pillow transformers accelerate sam2"

echo "=== Pre-downloading models ==="
gcloud compute ssh "$VM" --zone "$ZONE" --command \
  '~/sam3_venv/bin/python3 -c "
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
import torch
print(\"Loading Grounding DINO (float32)...\")
AutoProcessor.from_pretrained(\"IDEA-Research/grounding-dino-base\")
AutoModelForZeroShotObjectDetection.from_pretrained(\"IDEA-Research/grounding-dino-base\")
print(\"Grounding DINO cached.\")

from sam2.sam2_image_predictor import SAM2ImagePredictor
print(\"Loading SAM2 hiera-tiny...\")
SAM2ImagePredictor.from_pretrained(\"facebook/sam2-hiera-tiny\")
print(\"SAM2 cached.\")
print(\"ALL MODELS READY\")
"'

echo "=== VM setup complete ==="
