#!/usr/bin/env python3
"""
Builds the demo clip used by "Probar con un video de ejemplo".

The voice is synthesized word by word with espeak-ng (GPL tool; its *output* audio is ours to use),
so we know the exact time of every word and can ship a precomputed transcript: the demo opens
instantly, without downloading a Whisper model. The background is an animated gradient made with
FFmpeg. Replace it with your own clip for a nicer demo (see README).

Requirements: espeak-ng, ffmpeg (with libx264, aac, libvpx-vp9, libopus).
Usage: python3 scripts/make-demo.py
"""
import json
import subprocess
import tempfile
import wave
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "samples"
TEXT = (
    "¡Hola! Esto es Letritas. Arrastras tu video, la inteligencia artificial lo transcribe "
    "en tu propia computadora, y en segundos tienes subtítulos animados. Nada se sube a "
    "ningún servidor. Gratis, privado y listo para TikTok."
)
VOICE = "es-419"
SPEED = 150  # words per minute for espeak
RATE = 22050  # espeak-ng native sample rate
GAP = 0.07  # seconds between words
PAUSE = {",": 0.22, ".": 0.45, "!": 0.45, "?": 0.45}
LEAD_IN = 0.5


def synth(word: str, path: Path) -> array:
    subprocess.run(
        ["espeak-ng", "-v", VOICE, "-s", str(SPEED), "-w", str(path), word.strip("¡¿")],
        check=True,
    )
    with wave.open(str(path)) as w:
        assert w.getframerate() == RATE and w.getsampwidth() == 2
        samples = array("h", w.readframes(w.getnframes()))
    # Trim leading/trailing silence so word timings are tight.
    threshold = 500
    start = next((i for i, s in enumerate(samples) if abs(s) > threshold), 0)
    end = len(samples) - next((i for i, s in enumerate(reversed(samples)) if abs(s) > threshold), 0)
    return samples[max(0, start - 200) : min(len(samples), end + 200)]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    audio = array("h", [0] * int(LEAD_IN * RATE))
    words = []
    with tempfile.TemporaryDirectory() as tmp:
        for i, word in enumerate(TEXT.split()):
            clip = synth(word, Path(tmp) / f"{i}.wav")
            start = len(audio) / RATE
            audio.extend(clip)
            end = len(audio) / RATE
            words.append({"text": word, "start": round(start, 3), "end": round(end, 3)})
            pause = PAUSE.get(word[-1], GAP)
            audio.extend([0] * int(pause * RATE))
        audio.extend([0] * int(0.6 * RATE))
        wav = Path(tmp) / "voice.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(audio.tobytes())
        duration = len(audio) / RATE
        background = (
            f"gradients=size=720x1280:rate=30:duration={duration:.3f}:speed=0.015:"
            "c0=0x2a1458:c1=0x5a1233:c2=0x0b3b5a:c3=0x1a1a2e:nb_colors=4"
        )
        common = ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", background, "-i", str(wav)]
        subprocess.run(
            common
            + ["-c:v", "libx264", "-preset", "slow", "-crf", "30", "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-b:a", "64k", "-ar", "44100", "-movflags", "+faststart",
               "-shortest", str(OUT / "demo.mp4")],
            check=True,
        )
        subprocess.run(
            common
            + ["-c:v", "libvpx-vp9", "-b:v", "350k", "-deadline", "good", "-cpu-used", "4",
               "-c:a", "libopus", "-b:a", "48k", "-ar", "48000", "-shortest", str(OUT / "demo.webm")],
            check=True,
        )
    transcript = {"language": "es", "duration": round(duration, 3), "words": words}
    (OUT / "demo.words.json").write_text(json.dumps(transcript, ensure_ascii=False, indent=1) + "\n")
    print(f"demo: {duration:.1f}s, {len(words)} words")


if __name__ == "__main__":
    main()
