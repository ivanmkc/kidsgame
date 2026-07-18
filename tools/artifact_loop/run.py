"""Artifact detection loop: capture -> judge -> report, up to MAX_ROUNDS.

Usage:
    python run.py [--filter escape,musicbox,menu] [--max-rounds 4]

Writes each round to tools/audit_out/artifact_loop/round_N/
and a cumulative ledger to tools/audit_out/artifact_loop/LEDGER.md.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # kidsgame repo root
LOOP_DIR = ROOT / "tools" / "audit_out" / "artifact_loop"
CAPTURE_SCRIPT = Path(__file__).resolve().parent / "capture.mjs"
JUDGE_MODULE = Path(__file__).resolve().parent / "judge.py"

SURFACE_TO_ASSET_MAP = {
    "musicbox-twinkle": {"asset": "assets/game/musicbox/twinkle/", "gen": "gen_musicbox_scene.py --scene twinkle"},
    "musicbox-row": {"asset": "assets/game/musicbox/row/", "gen": "gen_musicbox_scene.py --scene row"},
    "musicbox-jingle": {"asset": "assets/game/musicbox/jingle/", "gen": "gen_musicbox_scene.py --scene jingle"},
    "escape-toyroom": {"asset": "assets/game/escape/toyroom/", "gen": "gen_escape.py --room toyroom"},
    "escape-dragoncave": {"asset": "assets/game/escape/dragoncave/", "gen": "gen_escape.py --room dragoncave"},
    "escape-rocketpad": {"asset": "assets/game/escape/rocketpad/", "gen": "gen_escape.py --room rocketpad"},
    "escape-piratecove": {"asset": "assets/game/escape/piratecove/", "gen": "gen_escape.py --room piratecove"},
}


def map_finding_to_asset(finding: dict) -> dict:
    """Add asset and regen command info to a finding based on surface name."""
    surface = finding["surface"]
    for prefix, info in SURFACE_TO_ASSET_MAP.items():
        if surface.startswith(prefix):
            finding["owning_asset"] = info["asset"]
            finding["regen_command"] = info["gen"]
            break
    return finding


def get_next_round() -> int:
    existing = [int(d.name.split("_")[1]) for d in LOOP_DIR.glob("round_*") if d.is_dir()]
    return max(existing, default=0) + 1


def capture(round_dir: Path, filter_str: str | None) -> Path:
    shots_dir = round_dir / "shots"
    shots_dir.mkdir(parents=True, exist_ok=True)
    cmd = ["node", str(CAPTURE_SCRIPT), str(shots_dir)]
    if filter_str:
        cmd.extend(["--filter", filter_str])
    print(f"\n--- CAPTURE (round {round_dir.name}) ---")
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"capture failed: {result.stderr}")
    return shots_dir / "captures.json"


def judge(captures_json: Path, round_dir: Path) -> list[dict]:
    findings_path = round_dir / "findings.json"
    print(f"\n--- JUDGE (round {round_dir.name}) ---")
    result = subprocess.run(
        [sys.executable, str(JUDGE_MODULE), str(captures_json), "-o", str(findings_path)],
        capture_output=True, text=True, cwd=str(ROOT),
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"judge failed: {result.stderr}")
    return json.loads(findings_path.read_text())


def write_report(findings: list[dict], round_dir: Path, round_num: int) -> None:
    report = round_dir / "report.md"
    lines = [f"# Artifact Loop — Round {round_num}", ""]
    lines.append(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"Total findings: {len(findings)}")
    lines.append("")

    if not findings:
        lines.append("**All surfaces clean. Loop converged.**")
    else:
        lines.append("| Surface | Class | Severity | Where | Description | Regen |")
        lines.append("|---------|-------|----------|-------|-------------|-------|")
        for f in findings:
            regen = f.get("regen_command", "—")
            lines.append(
                f"| {f['surface']} | {f['class']} | {f['severity']} "
                f"| {f['where'][:40]} | {f['description'][:60]} | `{regen}` |"
            )

    lines.append("")
    sev3 = [f for f in findings if f["severity"] >= 3]
    sev2 = [f for f in findings if f["severity"] == 2]
    sev1 = [f for f in findings if f["severity"] == 1]
    lines.append(f"Severity breakdown: {len(sev3)} critical, {len(sev2)} noticeable, {len(sev1)} minor")
    lines.append("")

    report.write_text("\n".join(lines))
    print(f"Report: {report}")


def update_ledger(findings: list[dict], round_num: int) -> None:
    ledger = LOOP_DIR / "LEDGER.md"
    if not ledger.exists():
        ledger.write_text("# Artifact Loop Ledger\n\nCumulative findings across rounds.\n\n")

    lines = [f"\n## Round {round_num} — {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"]
    if not findings:
        lines.append("All surfaces clean.\n")
    else:
        lines.append(f"{len(findings)} findings:\n")
        for f in findings:
            disposition = "pending"
            lines.append(
                f"- [{disposition}] **{f['class']}** sev={f['severity']} "
                f"on `{f['surface']}` — {f['description'][:80]}"
            )
        lines.append("")

    with open(ledger, "a") as fp:
        fp.writelines(l + "\n" for l in lines)
    print(f"Ledger updated: {ledger}")


def main():
    parser = argparse.ArgumentParser(description="Artifact detection loop")
    parser.add_argument("--filter", type=str, default=None,
                        help="Comma-separated surface prefixes to capture")
    parser.add_argument("--max-rounds", type=int, default=4)
    parser.add_argument("--round", type=int, default=None,
                        help="Run a specific round number (skips convergence check)")
    args = parser.parse_args()

    LOOP_DIR.mkdir(parents=True, exist_ok=True)

    if args.round is not None:
        round_num = args.round
    else:
        round_num = get_next_round()

    for r in range(round_num, round_num + args.max_rounds):
        round_dir = LOOP_DIR / f"round_{r}"
        round_dir.mkdir(parents=True, exist_ok=True)

        captures_json = capture(round_dir, args.filter)
        findings = judge(captures_json, round_dir)

        for f in findings:
            map_finding_to_asset(f)

        write_report(findings, round_dir, r)
        update_ledger(findings, r)

        if not findings:
            print(f"\n=== CONVERGED at round {r} — all surfaces clean ===")
            break

        print(f"\n=== Round {r}: {len(findings)} findings. ", end="")
        if r < round_num + args.max_rounds - 1:
            print("Proceeding to next round after fixes... ===")
            print("(In automated mode, fixes would be applied here.)")
            print("STOPPING — manual intervention needed for fixes.")
            break
        else:
            print(f"Max rounds ({args.max_rounds}) reached. ===")


if __name__ == "__main__":
    main()
