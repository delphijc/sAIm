#!/usr/bin/env python3
"""
Batch generator for all Realms of Tomorrow audio assets.
Generates 58 audio files sequentially using MusicGen-small on CPU.
Converts WAV → MP3 (192kbps) using lameenc (no ffmpeg needed).

Usage:
    python batch_generate_rot.py [--start-from N] [--dry-run]
"""

import argparse
import json
import os
import struct
import sys
import time
import wave
from pathlib import Path

# ── Output directories ──────────────────────────────────────────────────────
AUDIO_BASE = Path(
    "/home/obsidium/Projects/realms-of-tomorrow/projects/realms-of-tomorrow/frontend/static/audio"
)
REALM_DIR = AUDIO_BASE / "realm"
SPATIAL_DIR = AUDIO_BASE / "spatial"
SFX_DIR = AUDIO_BASE / "sfx"
LOG_FILE = AUDIO_BASE / "generation_log.json"

# ── Audio asset definitions ─────────────────────────────────────────────────
# Each entry: (output_subdir, filename, duration_seconds, prompt)
# Prompts are carefully crafted for MusicGen to produce high-quality ambient/SFX

ASSETS = [
    # ════════════════════════════════════════════════════════════════════════
    # REALM AMBIENT TRACKS (10) — 30s each, loopable ambient backgrounds
    # ════════════════════════════════════════════════════════════════════════
    ("realm", "pelago-ocean-waves.mp3", 30,
     "calm ocean waves lapping on a tropical shore, gentle sea breeze, distant seagulls calling, "
     "peaceful ambient soundscape, warm and serene, soft water sounds, no melody, pure nature ambience"),

    ("realm", "tidereach-forest-rain.mp3", 30,
     "gentle rain falling through a dense forest canopy, soft wind through leaves, "
     "occasional distant thunder rumble, peaceful woodland rain ambience, dripping water, "
     "nature sounds, no melody, atmospheric and calming"),

    ("realm", "ashenmere-desert-wind.mp3", 30,
     "howling desert wind across vast sand dunes, dry and desolate atmosphere, "
     "sand grains blowing, deep low drone, harsh arid environment, "
     "no melody, dark ambient desert soundscape, ominous and vast"),

    ("realm", "auraxis-palace-echoes.mp3", 30,
     "grand imperial palace ambience, echoing marble halls, distant ceremonial horns, "
     "soft murmur of a royal court, reverberant space, elegant and majestic atmosphere, "
     "subtle orchestral drone, regal ambient soundscape"),

    ("realm", "forge-nexus-industrial-hum.mp3", 30,
     "heavy industrial factory ambience, deep mechanical hum, rhythmic machinery pounding, "
     "steam hissing, metal grinding, dark and oppressive industrial atmosphere, "
     "toxic environment soundscape, no melody, gritty and relentless"),

    ("realm", "cryovault-arctic-wind.mp3", 30,
     "bitter arctic wind howling across frozen tundra, ice crystals tinkling, "
     "deep cold atmosphere, glacial creaking, desolate polar landscape, "
     "no melody, pure frozen wilderness ambience, haunting and isolated"),

    ("realm", "sylvara-forest-ambience.mp3", 30,
     "enchanted bioluminescent forest at night, soft magical humming, "
     "gentle alien insects chirping, ethereal glowing atmosphere, "
     "mysterious and beautiful woodland, fantasy forest ambience, "
     "subtle shimmering tones, otherworldly nature sounds"),

    ("realm", "verdania-jungle-ambience.mp3", 30,
     "thick tropical jungle ambience, exotic bird calls, monkey chatter in the distance, "
     "buzzing insects, dripping moisture from giant leaves, "
     "dense vegetation sounds, humid and alive, no melody, "
     "rich biodiversity soundscape"),

    ("realm", "iron-bastion-harsh-wind.mp3", 30,
     "harsh wind over a brutal military fortress, distant marching drums, "
     "chains rattling in the wind, oppressive and foreboding atmosphere, "
     "prison planet ambience, dark and authoritarian, "
     "metallic creaking, no melody, grim and unyielding"),

    ("realm", "voidreach-ethereal-void.mp3", 30,
     "ethereal cosmic void ambience, deep space drone, crystalline resonance, "
     "ghostly whispers echoing in emptiness, alien and otherworldly, "
     "pulsing energy, mysterious and vast, dark ambient space soundscape, "
     "no melody, transcendent and unknowable"),

    # ════════════════════════════════════════════════════════════════════════
    # SPATIAL EFFECTS (28) — 15-20s each, positional audio effects
    # ════════════════════════════════════════════════════════════════════════

    # -- Pelago spatial --
    ("spatial", "water-splash.mp3", 15,
     "water splashing rhythmically against wooden dock pilings, gentle harbor waves, "
     "close-up water sound effects, no melody, pure water ambience"),

    ("spatial", "boat-creaking.mp3", 15,
     "old wooden sailing boat creaking and groaning in gentle harbor waves, "
     "rope straining, wood flexing, maritime sound effects, no melody"),

    # -- Tidereach spatial --
    ("spatial", "river-flow.mp3", 20,
     "river flowing steadily through a forested valley, rushing water over rocks, "
     "gentle rapids, clear stream sounds, no melody, pure water flow ambience"),

    ("spatial", "distant-thunder.mp3", 15,
     "distant rolling thunder echoing across a mountain valley, "
     "deep rumbling storm approaching, atmospheric thunder sound effects, no melody"),

    # -- Ashenmere spatial --
    ("spatial", "sand-shifting.mp3", 20,
     "desert sand dunes shifting and sliding in the wind, fine grains of sand moving, "
     "dry rustling texture, subtle geological movement, no melody, "
     "desert sand sound effects"),

    ("spatial", "lithowyrm-rumble.mp3", 15,
     "deep subterranean rumbling, massive creature moving underground, "
     "earth trembling, rocks cracking, low frequency vibration, "
     "ominous deep bass rumble, no melody, geological disturbance"),

    ("spatial", "extractor-drone.mp3", 20,
     "industrial essence extractor machine humming and droning, "
     "mechanical engine running, electrical hum, pump sounds, "
     "steady industrial machine ambience, no melody"),

    # -- Auraxis spatial --
    ("spatial", "distant-crowd.mp3", 20,
     "murmur of a large crowd in a grand marble hall, "
     "distant voices chatting, formal gathering ambience, "
     "reverberant room tone, no melody, royal court atmosphere"),

    ("spatial", "fountain-water.mp3", 20,
     "ornamental stone fountain in a courtyard, water cascading and splashing, "
     "trickling water, peaceful garden fountain, no melody, "
     "elegant water feature sounds"),

    ("spatial", "herald-announcement.mp3", 10,
     "medieval herald trumpet fanfare, royal announcement horn blast, "
     "brass instrument call to attention, regal and commanding, "
     "short ceremonial trumpet call"),

    # -- Forge Nexus spatial --
    ("spatial", "steam-vent.mp3", 15,
     "high pressure steam venting from industrial pipes, hissing gas release, "
     "pressurized valve opening, factory steam sound effects, no melody, "
     "loud mechanical venting"),

    ("spatial", "machinery-clanking.mp3", 20,
     "heavy factory machinery clanking rhythmically, metal on metal, "
     "gears grinding, conveyor belts moving, industrial production line, "
     "no melody, repetitive mechanical sounds"),

    ("spatial", "alarm-klaxon.mp3", 10,
     "loud security alarm klaxon siren, emergency warning horn, "
     "industrial alert signal, pulsing alarm tone, "
     "urgent and alarming, factory emergency siren"),

    # -- Cryovault spatial --
    ("spatial", "ice-cracking.mp3", 15,
     "thick ice sheet fracturing and cracking, sharp brittle snapping sounds, "
     "glacial ice breaking, crystalline shattering, "
     "no melody, arctic ice sound effects"),

    ("spatial", "snowfall-whisper.mp3", 20,
     "soft gentle snowfall, quiet whisper of snow landing, "
     "peaceful winter silence, faint wind through snowflakes, "
     "no melody, serene and hushed, delicate winter ambience"),

    ("spatial", "distant-wolf-howl.mp3", 15,
     "wolf pack howling in the far distance across frozen tundra, "
     "echoing animal calls, lonely and haunting wolf cries, "
     "no melody, arctic wildlife sounds"),

    # -- Sylvara spatial --
    ("spatial", "bioluminescent-hum.mp3", 20,
     "soft otherworldly humming of bioluminescent plants glowing, "
     "gentle pulsing tones, magical flora resonating, "
     "ethereal and warm, fantasy nature sounds, subtle and enchanting"),

    ("spatial", "insect-chorus.mp3", 20,
     "exotic alien insects chirping and buzzing in a dense forest at night, "
     "rhythmic cricket-like sounds, strange clicking and trilling, "
     "no melody, fantasy jungle insect ambience"),

    ("spatial", "leaf-rustling.mp3", 15,
     "leaves rustling in a forest canopy, gentle wind through trees, "
     "soft leafy movement, branches swaying, "
     "no melody, peaceful forest foliage sounds"),

    # -- Verdania spatial --
    ("spatial", "exotic-birds.mp3", 20,
     "colorful exotic tropical birds calling and singing, "
     "parrots squawking, songbirds trilling, jungle bird chorus, "
     "no melody, rich tropical avian soundscape"),

    ("spatial", "vine-creaking.mp3", 15,
     "heavy jungle vines creaking and straining overhead, "
     "wood and fiber flexing under weight, organic stretching sounds, "
     "no melody, dense jungle canopy effects"),

    ("spatial", "waterfall.mp3", 20,
     "waterfall cascading into a deep jungle pool, roaring water, "
     "mist and spray, powerful water flow, rocks and splashing, "
     "no melody, tropical waterfall ambience"),

    # -- Iron Bastion spatial --
    ("spatial", "military-drums.mp3", 20,
     "ironclad military drums beating in steady march rhythm, "
     "deep war drums, powerful and imposing cadence, "
     "authoritarian military percussion, dark and driving"),

    ("spatial", "chains-rattling.mp3", 15,
     "heavy iron chains rattling and clanking, prisoner shackles, "
     "metal links scraping against stone, dungeon chain sounds, "
     "no melody, oppressive and dark"),

    ("spatial", "distant-marching.mp3", 20,
     "large formation of troops marching in perfect unison in the distance, "
     "synchronized footsteps on stone, military boot impacts, "
     "disciplined army march, no melody, authoritarian atmosphere"),

    # -- Voidreach spatial --
    ("spatial", "crystalline-resonance.mp3", 20,
     "crystal formations resonating in deep harmony, "
     "glass-like tones ringing and sustaining, mineral vibrations, "
     "alien crystal cave ambience, ethereal and shimmering, cosmic"),

    ("spatial", "whispering-echoes.mp3", 20,
     "ghostly whispers echoing through an infinite void, "
     "spectral voices, barely audible murmuring, "
     "eerie and unsettling, dark ambient whisper effects, haunting"),

    ("spatial", "energy-pulse.mp3", 20,
     "rhythmic energy pulse from an unknown cosmic source, "
     "pulsing bass throb, alien power surge, electrical resonance, "
     "sci-fi energy sound, deep and mysterious, steady rhythm"),

    # ════════════════════════════════════════════════════════════════════════
    # SFX — PUZZLE SOUNDS (6) — 3-5s each
    # ════════════════════════════════════════════════════════════════════════
    ("sfx", "puzzle-activate.mp3", 5,
     "mechanical click and gear engagement sound, puzzle mechanism activating, "
     "stone sliding into place, ancient lock opening, short sound effect"),

    ("sfx", "puzzle-correct-step.mp3", 3,
     "soft bright chime indicating correct answer, positive feedback tone, "
     "gentle bell ding, pleasant confirmation sound, short and clear"),

    ("sfx", "puzzle-incorrect.mp3", 3,
     "low buzzer sound for wrong answer, negative feedback tone, "
     "dull rejection buzz, error indication, short and distinct"),

    ("sfx", "puzzle-solved.mp3", 5,
     "triumphant ascending chord, puzzle completion fanfare, "
     "victorious bright tones, magical achievement sound, "
     "short celebratory musical phrase"),

    ("sfx", "hint-reveal.mp3", 4,
     "subtle mystical whisper tone, hint being revealed, "
     "soft magical shimmer, gentle discovery sound, "
     "quiet and mysterious, short ethereal chime"),

    ("sfx", "sequence-button.mp3", 2,
     "crisp digital button click, interface button press, "
     "clean mechanical tap, short and precise, UI interaction sound"),

    # ════════════════════════════════════════════════════════════════════════
    # SFX — ARTIFACT SOUNDS (3) — 3-5s each
    # ════════════════════════════════════════════════════════════════════════
    ("sfx", "artifact-discover.mp3", 5,
     "crystalline chime with collection whoosh, discovering a magical artifact, "
     "bright shimmering discovery sound, sparkling and exciting, "
     "treasure found fanfare, short and impactful"),

    ("sfx", "artifact-examine.mp3", 4,
     "soft resonating hum of examining a mystical object, "
     "gentle magical vibration, artifact inspection tone, "
     "warm and curious, subtle wonder sound"),

    ("sfx", "codex-open.mp3", 3,
     "old book page turning, leather journal opening, "
     "paper rustling, ancient codex being opened, "
     "short parchment sound effect"),

    # ════════════════════════════════════════════════════════════════════════
    # SFX — NAVIGATION SOUNDS (4) — 3-5s each
    # ════════════════════════════════════════════════════════════════════════
    ("sfx", "nav-transition.mp3", 4,
     "smooth whoosh transition sound, panoramic scene change, "
     "ambient crossfade swoosh, cinematic movement, "
     "flowing navigation sound effect"),

    ("sfx", "locked-path.mp3", 3,
     "dull heavy thud with rattle, locked door impact, "
     "blocked path rejection, wooden barrier bump, "
     "short denial sound effect"),

    ("sfx", "hotspot-hover.mp3", 2,
     "very subtle soft tone for hovering over interactive element, "
     "gentle UI highlight ping, barely audible focus indicator, "
     "delicate and minimal"),

    ("sfx", "realm-enter.mp3", 5,
     "cinematic whoosh with rising energy when entering a new realm, "
     "portal transition, magical gateway sound, dimensional shift, "
     "epic and immersive, short dramatic entrance"),

    # ════════════════════════════════════════════════════════════════════════
    # SFX — NPC SOUNDS (3) — 3-5s each
    # ════════════════════════════════════════════════════════════════════════
    ("sfx", "npc-murmur.mp3", 4,
     "subtle voice murmur, person speaking softly nearby, "
     "indistinct human whisper, gentle NPC presence indication, "
     "quiet and ambient, not words, just vocal tone"),

    ("sfx", "dialog-open.mp3", 3,
     "sci-fi terminal powering on, holographic display activating, "
     "electronic startup beep sequence, digital interface opening, "
     "futuristic computer activation sound"),

    ("sfx", "dialog-close.mp3", 3,
     "sci-fi terminal powering down, holographic display deactivating, "
     "electronic shutdown descending tone, digital interface closing, "
     "futuristic computer deactivation sound"),

    # ════════════════════════════════════════════════════════════════════════
    # SFX — UI SOUNDS (4) — 2-4s each
    # ════════════════════════════════════════════════════════════════════════
    ("sfx", "notification.mp3", 3,
     "soft notification ping, gentle alert chime, "
     "pleasant attention sound, clean digital notification, "
     "short and non-intrusive"),

    ("sfx", "xp-gain.mp3", 3,
     "rising positive tone for gaining experience points, "
     "ascending bright notes, reward and progress indication, "
     "satisfying collection sound, short upward musical phrase"),

    ("sfx", "level-up.mp3", 5,
     "triumphant level up fanfare, ascending celebratory notes, "
     "achievement unlocked sound, bright and exciting, "
     "short victory musical phrase with sparkle"),

    ("sfx", "button-click.mp3", 1,
     "clean crisp UI button click, simple interface tap, "
     "minimal digital press sound, very short and clean"),
]


def wav_to_mp3(wav_path: Path, mp3_path: Path, bitrate: int = 192) -> None:
    """Convert WAV to MP3 using lameenc (pure Python, no ffmpeg)."""
    import lameenc

    with wave.open(str(wav_path), "rb") as wf:
        n_channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        sample_rate = wf.getframerate()
        pcm_data = wf.readframes(wf.getnframes())

    encoder = lameenc.Encoder()
    encoder.set_bit_rate(bitrate)
    encoder.set_in_sample_rate(sample_rate)
    encoder.set_channels(n_channels)
    encoder.set_quality(2)  # 2 = high quality (0=best, 9=fastest)

    mp3_data = encoder.encode(pcm_data)
    mp3_data += encoder.flush()

    mp3_path.write_bytes(mp3_data)


def load_progress() -> dict:
    """Load generation progress from log file."""
    if LOG_FILE.exists():
        return json.loads(LOG_FILE.read_text())
    return {"completed": [], "failed": [], "total_time": 0}


def save_progress(progress: dict) -> None:
    """Save generation progress to log file."""
    LOG_FILE.write_text(json.dumps(progress, indent=2))


def main():
    parser = argparse.ArgumentParser(description="Batch generate RoT audio assets")
    parser.add_argument("--start-from", type=int, default=0,
                        help="Resume from asset index N (0-based)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be generated without doing it")
    parser.add_argument("--resume", action="store_true",
                        help="Skip already-completed assets (based on log)")
    args = parser.parse_args()

    progress = load_progress()

    print(f"╔══════════════════════════════════════════════════════════════╗")
    print(f"║  Realms of Tomorrow — Audio Asset Generator                 ║")
    print(f"║  {len(ASSETS)} assets to generate via MusicGen-small (CPU)          ║")
    print(f"║  Output: {AUDIO_BASE}  ║")
    print(f"╚══════════════════════════════════════════════════════════════╝")
    print()

    if args.dry_run:
        for i, (subdir, filename, duration, prompt) in enumerate(ASSETS):
            status = "SKIP" if filename in progress["completed"] else "GEN"
            print(f"  [{i+1:2d}/{len(ASSETS)}] [{status}] {subdir}/{filename} ({duration}s)")
            print(f"          Prompt: {prompt[:80]}...")
        print(f"\nTotal: {len(ASSETS)} assets")
        return

    # Lazy import heavy deps
    print("[init] Loading MusicGen model (this takes ~30s on first load)...")
    import warnings
    warnings.filterwarnings("ignore", category=UserWarning, module="xformers")

    import torch
    from audiocraft.models import MusicGen

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[init] Device: {device}")

    model = MusicGen.get_pretrained("facebook/musicgen-small")
    print("[init] Model loaded. Starting generation...\n")

    total_start = time.time()
    generated_count = 0
    skipped_count = 0

    for i, (subdir, filename, duration, prompt) in enumerate(ASSETS):
        if i < args.start_from:
            continue

        if args.resume and filename in progress["completed"]:
            print(f"  [{i+1:2d}/{len(ASSETS)}] SKIP (already done): {subdir}/{filename}")
            skipped_count += 1
            continue

        # Determine output directory
        if subdir == "realm":
            out_dir = REALM_DIR
        elif subdir == "spatial":
            out_dir = SPATIAL_DIR
        else:
            out_dir = SFX_DIR

        mp3_path = out_dir / filename
        wav_path = Path(f"/tmp/rot_gen_{filename.replace('.mp3', '.wav')}")

        print(f"  [{i+1:2d}/{len(ASSETS)}] Generating: {subdir}/{filename} ({duration}s)")
        print(f"          Prompt: {prompt[:90]}...")

        try:
            # Generate audio
            model.set_generation_params(duration=duration)
            gen_start = time.time()
            wav_tensor = model.generate([prompt])
            gen_elapsed = time.time() - gen_start

            # Save WAV
            audio = wav_tensor[0].cpu()
            sample_rate = model.sample_rate

            import soundfile as sf
            import numpy as np
            audio_np = audio.numpy().T
            sf.write(str(wav_path), audio_np, sample_rate, subtype="PCM_16")

            # Convert to MP3
            wav_to_mp3(wav_path, mp3_path, bitrate=192)

            # Cleanup temp WAV
            wav_path.unlink(missing_ok=True)

            mp3_size = mp3_path.stat().st_size / 1024
            print(f"          ✓ Done in {gen_elapsed:.1f}s → {mp3_size:.0f} KB")

            progress["completed"].append(filename)
            generated_count += 1

        except Exception as e:
            print(f"          ✗ FAILED: {e}")
            progress["failed"].append({"file": filename, "error": str(e)})
            wav_path.unlink(missing_ok=True)

        # Save progress after each file
        progress["total_time"] = time.time() - total_start
        save_progress(progress)

    total_elapsed = time.time() - total_start
    print(f"\n{'='*60}")
    print(f"  COMPLETE: {generated_count} generated, {skipped_count} skipped, "
          f"{len(progress['failed'])} failed")
    print(f"  Total time: {total_elapsed/60:.1f} minutes")
    print(f"  Log: {LOG_FILE}")
    print(f"{'='*60}")


if __name__ == "__main__":
    sys.exit(main() or 0)
