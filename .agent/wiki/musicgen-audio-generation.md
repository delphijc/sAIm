# MusicGen Audio Generation

## Overview

**MusicGen** is Meta's text-to-audio generation model, integrated into PAI as a CLI tool for generating audio from text prompts. Built on Meta's [AudioCraft](https://github.com/facebookresearch/audiocraft) library.

**Location:** `.agent/tools/musicgen/`

## Components

| File | Purpose |
|------|---------|
| `musicgen` | Bash CLI wrapper — entry point for all generation |
| `generate.py` | Core Python generation script (single-file mode) |
| `venv/` | Python 3.12 virtual environment with all dependencies |

## Dependencies

Installed in the tool's dedicated venv:

- **audiocraft** 1.3.0 — Meta's audio generation library
- **torch** + **torchaudio** 2.10.0+cpu — PyTorch (CPU-only)
- **librosa** 0.11.0 — Audio analysis
- **soundfile** — WAV I/O via libsndfile
- **lameenc** — Pure-Python WAV-to-MP3 conversion (no ffmpeg needed)
- **transformers**, **huggingface_hub** — Model downloading/caching

## Usage

```bash
# Basic usage
.agent/tools/musicgen/musicgen --prompt "ocean waves with distant whale songs" --duration 15 --output /tmp/ocean.wav

# With model variant
.agent/tools/musicgen/musicgen --prompt "thunderstorm in a forest" --model facebook/musicgen-medium
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--prompt` | *(required)* | Text description of audio to generate |
| `--duration` | 10s | Length in seconds (max 30 for musicgen-small) |
| `--output` | Auto `/tmp/musicgen_*.wav` | Output WAV file path |
| `--model` | `facebook/musicgen-small` | HuggingFace model ID |

## Model Variants

| Model | Parameters | VRAM/RAM | Quality | Speed (CPU, 10s clip) |
|-------|-----------|----------|---------|----------------------|
| `facebook/musicgen-small` | 300M | ~2 GB | Good | 20-50s |
| `facebook/musicgen-medium` | 1.5B | ~6 GB | Better | 60-120s |
| `facebook/musicgen-large` | 3.3B | ~12 GB | Best | 180-300s |

Weights are cached at `~/.cache/huggingface/` (~300MB for small).

## Performance Notes

- **CPU inference only** on current hardware (Mac Pro 6,1 / Linux Mint)
- Expect ~2-5x real-time for musicgen-small (10s clip takes 20-50s)
- First run downloads model weights (~300MB)
- Output format: MP3 at 192kbps (converted from WAV using lameenc)

## Setup

If the venv needs to be recreated:

```bash
cd ~/.agent/tools/musicgen
python3 -m venv venv
./venv/bin/pip install audiocraft torch torchaudio soundfile lameenc librosa
```

## Projects Using MusicGen

- **[Realms of Tomorrow](~$HOME/Projects/realms-of-tomorrow/docs/audio-generation.md)** — 58 generated audio assets (ambient tracks, spatial effects, interaction SFX)

## Related

- [Voice Server](voice-server) — PAI's TTS system (separate from MusicGen)
