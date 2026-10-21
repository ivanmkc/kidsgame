"""Tests for BatchExecutor."""

import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from batch_executor import BatchExecutor


def test_execute_all_batches(tmp_path):
    plan = [["item1", "item2"], ["item3"], ["item4", "item5"]]
    state_file = tmp_path / "state.json"
    processed = []

    def callback(batch):
        processed.append(list(batch))
        return len(batch)

    executor = BatchExecutor(plan, state_file, callback)
    results = executor.execute()

    assert results == [2, 1, 2]
    assert processed == [["item1", "item2"], ["item3"], ["item4", "item5"]]
    assert state_file.exists()

    state = json.loads(state_file.read_text())
    assert state["completed_index"] == 2
    assert state["plan_fingerprint"] == executor.fingerprint
    assert executor.get_completed_index() == 2


def test_resume_from_checkpoint(tmp_path):
    plan = [["batch0"], ["batch1"], ["batch2"], ["batch3"]]
    state_file = tmp_path / "state.json"
    processed = []

    def failing_callback(batch):
        if batch == ["batch2"]:
            raise RuntimeError("API quota error")
        processed.append(batch[0])

    executor1 = BatchExecutor(plan, state_file, failing_callback)
    with pytest.raises(RuntimeError, match="API quota error"):
        executor1.execute()

    assert processed == ["batch0", "batch1"]
    assert executor1.get_completed_index() == 1

    # Restart execution with working callback
    resumed_processed = []

    def resume_callback(batch):
        resumed_processed.append(batch[0])

    executor2 = BatchExecutor(plan, state_file, resume_callback)
    assert executor2.get_completed_index() == 1
    executor2.execute()

    # Only batch2 and batch3 should have been executed in the second run
    assert resumed_processed == ["batch2", "batch3"]
    assert executor2.get_completed_index() == 3


def test_plan_from_file_path(tmp_path):
    plan_data = [["a"], ["b"]]
    plan_file = tmp_path / "plan.json"
    plan_file.write_text(json.dumps(plan_data))
    state_file = tmp_path / "state.json"

    processed = []
    executor = BatchExecutor(plan_file, state_file, lambda b: processed.extend(b))
    executor.execute()

    assert processed == ["a", "b"]
    assert executor.get_completed_index() == 1


def test_plan_fingerprint_mismatch_resets_completed_index(tmp_path):
    plan1 = [["a"], ["b"]]
    plan2 = [["c"], ["d"]]
    state_file = tmp_path / "state.json"

    executor1 = BatchExecutor(plan1, state_file, lambda b: None)
    executor1.execute()
    assert executor1.get_completed_index() == 1

    # Same state file with a different plan
    processed = []
    executor2 = BatchExecutor(plan2, state_file, lambda b: processed.extend(b))
    assert executor2.get_completed_index() == -1

    executor2.execute()
    assert processed == ["c", "d"]
    assert executor2.get_completed_index() == 1


def test_already_completed_plan(tmp_path):
    plan = [["a"], ["b"]]
    state_file = tmp_path / "state.json"
    fingerprint = hashlib.sha256(json.dumps(plan, sort_keys=True, default=str).encode("utf-8")).hexdigest()
    state_file.write_text(json.dumps({
        "completed_index": 1,
        "plan_fingerprint": fingerprint,
    }))

    called = []
    executor = BatchExecutor(plan, state_file, lambda b: called.append(b))
    assert executor.get_completed_index() == 1
    results = executor.execute()

    assert results == []
    assert called == []


def test_empty_plan(tmp_path):
    state_file = tmp_path / "state.json"
    executor = BatchExecutor([], state_file, lambda b: b)
    results = executor.execute()

    assert results == []
    assert not state_file.exists()


def test_invalid_arguments_fail_loudly(tmp_path):
    state_file = tmp_path / "state.json"

    # Not callable
    with pytest.raises(TypeError, match="callback must be callable"):
        BatchExecutor([], state_file, "not-callable")

    # Plan as string rejected (must be Path or Sequence)
    with pytest.raises(TypeError, match="Invalid plan type"):
        BatchExecutor("plan.json", state_file, lambda b: b)

    # Invalid plan type
    with pytest.raises(TypeError, match="Invalid plan type"):
        BatchExecutor(123, state_file, lambda b: b)

    # Non-existent Path
    with pytest.raises(FileNotFoundError):
        BatchExecutor(Path("nonexistent_plan.json"), state_file, lambda b: b)

    # Plan file does not contain a list
    dict_plan = tmp_path / "dict_plan.json"
    dict_plan.write_text('{"not": "a list"}')
    with pytest.raises(ValueError, match="Plan must be a list"):
        BatchExecutor(dict_plan, state_file, lambda b: b)


def test_corrupted_state_file_fails_loudly(tmp_path):
    state_file = tmp_path / "state.json"
    state_file.write_text("invalid json")

    executor = BatchExecutor([["a"]], state_file, lambda b: b)
    with pytest.raises(json.JSONDecodeError):
        executor.execute()

    state_file.write_text('{"unknown_key": 123}')
    with pytest.raises(ValueError, match="Could not determine completed index"):
        executor.execute()

    state_file.write_text("1")
    with pytest.raises(ValueError, match="Could not determine completed index"):
        executor.execute()

    state_file.write_text('{"completed_index": "not_an_int"}')
    with pytest.raises(ValueError, match="Invalid completed_index"):
        executor.execute()
