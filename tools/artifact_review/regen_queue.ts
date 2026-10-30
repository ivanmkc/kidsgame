import {
  generatorFor,
  REGEN_MODELS,
  type GeneratorTarget,
  type RegenModelKind,
} from "../review/regenConfig";

export interface RegenJob {
  asset: string;
  mediaKind: RegenModelKind;
  generator: string;
  specRef: string;
  model: string | readonly string[];
}

export type RegenConfig = Record<RegenModelKind, string | readonly string[]>;

export interface VerdictEntry {
  readonly path: string;
  readonly verdict: string;
  readonly note?: string;
}

export type VerdictExport = readonly VerdictEntry[];

export function isRegenerateVerdict(verdict: string): boolean {
  const norm = verdict.trim().toLowerCase().replace(/_/g, "-");
  return norm === "regenerate" || norm.startsWith("regenerate-");
}

export function extractSpecRef(target: GeneratorTarget): string {
  if (target.args.length === 0) {
    return "";
  }
  const onlyIdx = target.args.indexOf("--only");
  if (onlyIdx >= 0 && onlyIdx + 1 < target.args.length) {
    return target.args[onlyIdx + 1];
  }
  return target.args[0] ?? "";
}

export function buildRegenQueue(
  verdicts: VerdictExport,
  config: RegenConfig = REGEN_MODELS,
): { jobs: RegenJob[]; unmatched: string[] } {
  const jobs: RegenJob[] = [];
  const unmatched: string[] = [];
  const seenJobs = new Set<string>();
  const seenUnmatched = new Set<string>();

  for (const entry of verdicts) {
    const normVerdict = entry.verdict.trim().toLowerCase().replace(/_/g, "-");
    if (!isRegenerateVerdict(normVerdict)) {
      continue;
    }
    const normAsset = entry.path
      .replace(/\\/g, "/")
      .replace(/^\.\//, "")
      .replace(/^\/+/, "");
    if (!normAsset) {
      continue;
    }

    const target = generatorFor(normAsset);
    if (!target) {
      if (!seenUnmatched.has(normAsset)) {
        seenUnmatched.add(normAsset);
        unmatched.push(normAsset);
      }
      continue;
    }

    if (
      (normVerdict === "regenerate-video" && target.model !== "video") ||
      (normVerdict === "regenerate-image" && target.model !== "image")
    ) {
      if (!seenUnmatched.has(normAsset)) {
        seenUnmatched.add(normAsset);
        unmatched.push(normAsset);
      }
      continue;
    }

    const mediaKind = target.model;
    const model = config[mediaKind];
    const specRef = extractSpecRef(target);

    if (!seenJobs.has(normAsset)) {
      seenJobs.add(normAsset);
      jobs.push({
        asset: normAsset,
        mediaKind,
        generator: target.script,
        specRef,
        model,
      });
    }
  }

  jobs.sort((a, b) => a.asset.localeCompare(b.asset));
  unmatched.sort((a, b) => a.localeCompare(b));

  return { jobs, unmatched };
}

export function formatPlan(plan: {
  jobs: RegenJob[];
  unmatched: string[];
}): string {
  const lines: string[] = [];
  for (const job of plan.jobs) {
    const spec = job.specRef ? ` ${job.specRef}` : "";
    const modelStr =
      typeof job.model === "string" ? job.model : job.model.join(", ");
    lines.push(
      `${job.asset} [${job.mediaKind}] -> ${job.generator}${spec} (${modelStr})`,
    );
  }
  lines.push("Unmatched:");
  if (plan.unmatched.length === 0) {
    lines.push("  (none)");
  } else {
    for (const u of plan.unmatched) {
      lines.push(`  ${u}`);
    }
  }
  return lines.join("\n");
}
