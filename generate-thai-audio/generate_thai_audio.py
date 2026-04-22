import asyncio
import csv
import re
import random
from pathlib import Path

import edge_tts

# ====== SETTINGS ======
INPUT_CSV = "thai_words.csv"
OUTPUT_DIR = "audio"
VOICE = "th-TH-PremwadeeNeural"   # Try "th-TH-NiwatNeural" for male voice
RATE = "-5%"
VOLUME = "+0%"
PITCH = "+0Hz"
FILE_NAME_MODE = "id"             # "id" or "slug"

# Timing / retry settings
SUCCESS_DELAY_MIN = 1.2
SUCCESS_DELAY_MAX = 2.0

FIRST_PASS_MAX_ATTEMPTS = 2
SECOND_PASS_MAX_ATTEMPTS = 5

SECOND_PASS_COOLDOWN = 60         # wait before retrying failed rows

# ======================


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[^a-z0-9_/-]", "", text)
    return text[:80] or "audio"


def make_filename(row: dict, index: int) -> str:
    if FILE_NAME_MODE == "slug":
        base = slugify(
            row.get("romanized", "") or row.get("english", "") or f"row_{index}"
        )
        return f"{base}.mp3"

    raw_id = str(row.get("id", "")).strip()
    if raw_id:
        return f"{raw_id.zfill(3)}.mp3"
    return f"{index:03}.mp3"


async def save_tts(thai_text: str, output_path: Path):
    temp_path = output_path.with_suffix(".tmp.mp3")

    # Clean up any old temp file first
    if temp_path.exists():
        temp_path.unlink()

    try:
        communicate = edge_tts.Communicate(
            text=thai_text,
            voice=VOICE,
            rate=RATE,
            volume=VOLUME,
            pitch=PITCH,
        )
        await communicate.save(str(temp_path))

        # Make sure something real was written
        if not temp_path.exists() or temp_path.stat().st_size == 0:
            raise RuntimeError("TTS returned no usable audio file")

        # Replace final file only after success
        temp_path.replace(output_path)

    except Exception:
        if temp_path.exists():
            temp_path.unlink()
        raise


async def synthesize_with_retries(
    row: dict,
    index: int,
    out_dir: Path,
    max_attempts: int,
    backoff_mode: str = "light",
):
    thai_text = (row.get("thai") or "").strip()
    if not thai_text:
        print(f"Skipping row {index}: missing 'thai'")
        return None

    filename = make_filename(row, index)
    output_path = out_dir / filename

    if output_path.exists():
        print(f"Skipping row {index} (already exists): {output_path}")
        return filename

    for attempt in range(1, max_attempts + 1):
        try:
            await save_tts(thai_text, output_path)
            print(f"Saved: {output_path}")
            await asyncio.sleep(random.uniform(SUCCESS_DELAY_MIN, SUCCESS_DELAY_MAX))
            return filename

        except Exception as e:
            print(f"Attempt {attempt} failed for row {index} ({thai_text}): {e}")

            if attempt == max_attempts:
                return None

            if backoff_mode == "light":
                delay = (1.5 * attempt) + random.uniform(0.5, 1.2)
            else:
                delay = (2 ** attempt) * 2 + random.uniform(0.8, 2.0)

            print(f"Retrying row {index} in {delay:.1f}s...")
            await asyncio.sleep(delay)

    return None


async def main():
    out_dir = Path(OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    with open(INPUT_CSV, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("No rows found.")
        return

    required = {"thai"}
    missing = required - set(rows[0].keys())
    if missing:
        raise ValueError(
            f"CSV is missing required column(s): {', '.join(sorted(missing))}"
        )

    results = [None] * len(rows)
    failed_indices = []

    print("=== First pass ===")
    for index, row in enumerate(rows, start=1):
        result = await synthesize_with_retries(
            row=row,
            index=index,
            out_dir=out_dir,
            max_attempts=FIRST_PASS_MAX_ATTEMPTS,
            backoff_mode="light",
        )
        results[index - 1] = result
        if result is None and (row.get("thai") or "").strip():
            failed_indices.append(index - 1)

    if failed_indices:
        print(f"\nFirst pass complete. {len(failed_indices)} row(s) failed.")
        print(f"Cooling down for {SECOND_PASS_COOLDOWN} seconds before second pass...\n")
        await asyncio.sleep(SECOND_PASS_COOLDOWN)

        print("=== Second pass ===")
        still_failed = []

        for row_idx in failed_indices:
            row = rows[row_idx]
            index = row_idx + 1

            result = await synthesize_with_retries(
                row=row,
                index=index,
                out_dir=out_dir,
                max_attempts=SECOND_PASS_MAX_ATTEMPTS,
                backoff_mode="strong",
            )
            results[row_idx] = result

            if result is None:
                still_failed.append(index)

        if still_failed:
            print(f"\nStill failed after second pass: {still_failed}")
        else:
            print("\nSecond pass recovered all failed rows.")

    output_csv = out_dir / "audio_manifest.csv"
    fieldnames = list(rows[0].keys()) + ["audio"]

    with open(output_csv, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for i, row in enumerate(rows):
            audio_file = results[i]
            out_row = dict(row)
            out_row["audio"] = f"[sound:{audio_file}]" if audio_file else ""
            writer.writerow(out_row)

    print(f"\nDone. Manifest written to: {output_csv}")


if __name__ == "__main__":
    asyncio.run(main())