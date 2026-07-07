"""Storybook spec lint — every rule this pipeline learned the hard way.

Run standalone (`python3 tools/gen/story_lint.py`) or let gen_stories call
lint_spec() before rendering. Fail fast at author time, not at audit time.
"""
from __future__ import annotations

HOTSPOT_SIDE_WORDS = ("LEFT", "RIGHT")


def lint_spec(spec: dict) -> list[str]:
    errs: list[str] = []
    nodes = spec.get("nodes", {})
    ids = set(nodes)
    if "start" not in ids:
        errs.append("no 'start' node")
    reachable = set()
    for nid, n in nodes.items():
        chs = n.get("choices", [])
        for c in chs:
            reachable.add(c["next"])
            if c["next"] not in ids:
                errs.append(f"{nid}: choice -> unknown node '{c['next']}'")
        if chs:
            spots = [c.get("spot") for c in chs]
            if any(spots) and not all(spots):
                errs.append(f"{nid}: SOME choices have 'spot' — hotspots are all-or-nothing per node")
            if all(spots):
                # scene must place both affordances explicitly and distinctly
                scene = n.get("scene", "")
                for w in HOTSPOT_SIDE_WORDS:
                    if w not in scene:
                        errs.append(f"{nid}: hotspot node scene prompt should place affordances with '{w}' (both large, fully visible, clearly separated)")
                for c in chs:
                    s = c["spot"]
                    if len(s.split()) > 4:
                        errs.append(f"{nid}: spot '{s}' is long — SAM misses wordy phrases; use <=4 words (color + noun)")
                    for bad in ("string", "rope ", "stick", "thin"):
                        pass  # advisory only; thin structures often fail SAM — flagged at gen time
        else:
            if not nid.startswith("end"):
                errs.append(f"{nid}: no choices but id doesn't start with 'end'")
            if n.get("bad") and "Oopsie" not in n.get("text", ""):
                errs.append(f"{nid}: bad ending text should say 'Oopsie ending!' so kids/parents recognize the flop tone")
    # endings + reachability
    for nid, n in nodes.items():
        if nid != "start" and nid not in reachable:
            errs.append(f"{nid}: unreachable")
    ends = [nid for nid, n in nodes.items() if not n.get("choices")]
    bads = [nid for nid in ends if nodes[nid].get("bad")]
    if len(ends) < 3:
        errs.append(f"only {len(ends)} endings — need >=3 so choices matter")
    if not bads:
        errs.append("warn: no bad ending — choices need real consequences (new books must add >=1 'Oopsie ending', bad: True)")
    # depth: every path from start should pass >=3 choice nodes
    def min_depth(nid: str, seen: frozenset) -> int:
        n = nodes.get(nid, {})
        chs = n.get("choices", [])
        if not chs:
            return 0
        return 1 + min((min_depth(c["next"], seen | {nid}) for c in chs if c["next"] not in seen), default=0)
    # shared endings: every parent path must arrive somewhere the ending's
    # scene can honestly depict — flag for bespoke-split review (the
    # 'X-marks-the-spot on the wrong beach' class).
    parents: dict[str, list[str]] = {}
    for nid, n in nodes.items():
        for c in n.get("choices", []):
            parents.setdefault(c["next"], []).append(nid)
    for end in ends:
        if len(parents.get(end, [])) > 1:
            errs.append(f"warn: ending '{end}' has parents {parents[end]} — verify its scene is location-coherent from EVERY path, else split bespoke")
    if "start" in ids and min_depth("start", frozenset()) < 3:
        errs.append("shallowest path has <3 decisions — kids need >=3 choices per read")
    elif "start" in ids and min_depth("start", frozenset()) < 4:
        errs.append("warn: shallowest path has 3 decisions — NEW books need >=4 (Ivan: stories too short)")
    return errs


def main() -> int:
    import sys
    sys.path.insert(0, __file__.rsplit("/", 2)[0])
    from gen.story_specs import RAINBOW_DOORS, SCARE_SCHOOL, TREASURE_TRAIL, WHISPERING_HOUSE
    bad = 0
    for spec in (WHISPERING_HOUSE, SCARE_SCHOOL, RAINBOW_DOORS, TREASURE_TRAIL):
        errs = lint_spec(spec)
        print(f"{spec['id']}: {'OK' if not errs else f'{len(errs)} issue(s)'}")
        for e in errs:
            print(f"  - {e}")
        bad += bool([e for e in errs if not e.startswith("warn:")])
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
