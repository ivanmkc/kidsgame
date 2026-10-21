"""Incremental batch executor with checkpointing."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Callable, Sequence


class BatchExecutor:
    """Executes a plan of batches incrementally, maintaining checkpoint state."""

    def __init__(
        self,
        plan: Sequence[Any] | Path,
        state_file: str | Path,
        callback: Callable[[Any], Any],
        fingerprint_seed: str | None = None,
    ) -> None:
        self.state_file = Path(state_file)
        if not callable(callback):
            raise TypeError("callback must be callable")
        self.callback = callback

        if isinstance(plan, Path):
            self.plan: list[Any] = json.loads(plan.read_text(encoding="utf-8"))
        elif isinstance(plan, Sequence) and not isinstance(plan, (str, bytes)):
            self.plan = list(plan)
        else:
            raise TypeError(f"Invalid plan type: {type(plan).__name__}")

        if not isinstance(self.plan, list):
            raise ValueError(f"Plan must be a list of batches, got {type(self.plan).__name__}")

        canonical = json.dumps(self.plan, sort_keys=True, default=str)
        if fingerprint_seed:
            canonical += f":{fingerprint_seed}"
        self.fingerprint = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def get_completed_index(self) -> int:
        """Returns the highest completed batch index, or -1 if none or plan mismatch."""
        if not self.state_file.exists():
            return -1
        content = self.state_file.read_text(encoding="utf-8").strip()
        if not content:
            return -1
        data = json.loads(content)
        if not isinstance(data, dict) or "completed_index" not in data:
            raise ValueError(f"Could not determine completed index from state file: {self.state_file}")

        index = data["completed_index"]
        if not isinstance(index, int):
            raise ValueError(f"Invalid completed_index in state file: {index}")

        if data.get("plan_fingerprint") != self.fingerprint:
            return -1

        return index

    def _save_state(self, index: int) -> None:
        """Atomically saves the highest completed batch index."""
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "completed_index": index,
            "plan_fingerprint": self.fingerprint,
        }
        temp_file = self.state_file.with_name(f"{self.state_file.name}.tmp")
        temp_file.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        temp_file.replace(self.state_file)

    def execute(self) -> list[Any]:
        """Executes all remaining batches starting after the last completed batch index."""
        start_index = self.get_completed_index() + 1
        results: list[Any] = []
        for idx in range(start_index, len(self.plan)):
            batch = self.plan[idx]
            result = self.callback(batch)
            self._save_state(idx)
            results.append(result)
        return results
