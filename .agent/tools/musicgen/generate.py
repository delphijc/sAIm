#!/usr/bin/env python3
"""
MusicGen audio generation script using Meta's facebook/musicgen-small model.

Usage:
    python generate.py --prompt "ambient forest sounds" --duration 10 --output /tmp/output.wav
"""

import argparse
import sys
import time
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate audio from a text prompt using MusicGen-small.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate.py --prompt "peaceful piano melody" --duration 10
  python generate.py --prompt "ocean waves with distant whale songs" --duration 15 --output /tmp/ocean.wav
  python generate.py --prompt "upbeat electronic loop" --duration 30 --output ~/music/loop.wav
        """,
    )
    parser.add_argument(
        "--prompt",
        required=True,
        type=str,
        help="Text description of the audio to generate.",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=10.0,
        help="Duration in seconds (default: 10, max: 30 for musicgen-small).",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output WAV file path (default: auto-generated in /tmp/).",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="facebook/musicgen-small",
        help="HuggingFace model ID (default: facebook/musicgen-small).",
    )
    return parser.parse_args()


def resolve_output_path(output_arg: str | None, prompt: str) -> Path:
    if output_arg is not None:
        path = Path(output_arg).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    # Auto-generate a filename in /tmp based on a slugified prompt
    slug = "".join(c if c.isalnum() else "_" for c in prompt[:40]).strip("_")
    timestamp = int(time.time())
    return Path(f"/tmp/musicgen_{slug}_{timestamp}.wav")


def validate_duration(duration: float) -> float:
    max_duration = 30.0
    min_duration = 1.0
    if duration < min_duration:
        print(f"[warn] Duration {duration}s is below minimum {min_duration}s. Clamping.", file=sys.stderr)
        return min_duration
    if duration > max_duration:
        print(f"[warn] Duration {duration}s exceeds max {max_duration}s for musicgen-small. Clamping.", file=sys.stderr)
        return max_duration
    return duration


def _save_wav(audio_tensor, sample_rate: int, output_path: Path) -> None:
    """Save audio tensor to WAV file.

    torchaudio 2.10+ requires torchcodec for its default save backend.
    We fall back to soundfile (WAV via libsndfile) which is always available
    in this venv and doesn't need any codec infrastructure.
    """
    import numpy as np
    import soundfile as sf

    # audio_tensor shape: (channels, samples) — soundfile expects (samples, channels)
    audio_np = audio_tensor.numpy().T  # (samples, channels)
    sf.write(str(output_path), audio_np, sample_rate, subtype="PCM_16")


def generate(prompt: str, duration: float, output_path: Path, model_id: str) -> None:
    print(f"[musicgen] Loading model: {model_id}")
    print(f"[musicgen] This may take a minute on first run (downloading weights)...")

    # Suppress xformers CPU warning — expected on CPU-only setup
    import warnings
    warnings.filterwarnings("ignore", category=UserWarning, module="xformers")

    import torch
    from audiocraft.models import MusicGen

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[musicgen] Using device: {device}")

    model = MusicGen.get_pretrained(model_id)
    model.set_generation_params(duration=duration)

    print(f"[musicgen] Prompt  : {prompt!r}")
    print(f"[musicgen] Duration: {duration}s")
    print(f"[musicgen] Output  : {output_path}")
    print(f"[musicgen] Generating audio (CPU inference — please wait)...")

    start = time.time()
    wav = model.generate([prompt])  # returns tensor shape (1, channels, samples)
    elapsed = time.time() - start

    print(f"[musicgen] Generation complete in {elapsed:.1f}s")

    # wav shape: (batch, channels, samples) — take first item
    audio = wav[0]  # shape: (channels, samples)

    sample_rate = model.sample_rate
    _save_wav(audio.cpu(), sample_rate, output_path)

    # Stat the output file
    size_kb = output_path.stat().st_size / 1024
    print(f"[musicgen] Saved: {output_path} ({size_kb:.1f} KB, {sample_rate}Hz)")


def main() -> int:
    args = parse_args()

    duration = validate_duration(args.duration)
    output_path = resolve_output_path(args.output, args.prompt)

    try:
        generate(
            prompt=args.prompt,
            duration=duration,
            output_path=output_path,
            model_id=args.model,
        )
    except KeyboardInterrupt:
        print("\n[musicgen] Interrupted.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"[musicgen] Error: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
