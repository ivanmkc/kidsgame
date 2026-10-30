import * as fs from "node:fs";
import * as path from "node:path";
import { type RegenJob } from "./regen_queue";
import {
  type CandidateManifest,
  type GenerateImageRequest,
  type GenerateImageResponse,
  type ImageModelClient,
  type RunnerIo,
  runImageRegeneration,
} from "./regen_runner";

export class VertexImageClient implements ImageModelClient {
  async generateImage(req: GenerateImageRequest): Promise<GenerateImageResponse> {
    const project =
      process.env.GOOGLE_CLOUD_PROJECT || "ivanmkc-experimental-665175";
    const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    if (!token) {
      throw new Error(
        "GOOGLE_OAUTH_ACCESS_TOKEN environment variable is required",
      );
    }

    const errors: string[] = [];

    for (const model of req.model) {
      try {
        const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`;

        const parts: Array<
          { text: string } | { inlineData: { mimeType: string; data: string } }
        > = [{ text: req.prompt }];

        if (req.referenceImage && req.referenceImage.length > 0) {
          parts.push({
            inlineData: {
              mimeType: req.mimeType,
              data: Buffer.from(
                req.referenceImage.buffer,
                req.referenceImage.byteOffset,
                req.referenceImage.byteLength,
              ).toString("base64"),
            },
          });
        }

        const payload = {
          contents: [
            {
              role: "user",
              parts,
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
          },
        };

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Vertex AI HTTP ${res.status}: ${errorText}`);
        }

        const data = (await res.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                inlineData?: {
                  mimeType?: string;
                  data?: string;
                };
                inline_data?: {
                  mime_type?: string;
                  data?: string;
                };
              }>;
            };
          }>;
        };

        let imageBase64: string | undefined;
        for (const cand of data?.candidates ?? []) {
          for (const part of cand?.content?.parts ?? []) {
            const inline = part?.inlineData ?? part?.inline_data;
            if (inline?.data) {
              imageBase64 = inline.data;
              break;
            }
          }
          if (imageBase64) break;
        }

        if (!imageBase64) {
          throw new Error("Vertex AI response contained no image data");
        }

        const buffer = Buffer.from(imageBase64, "base64");
        return {
          bytes: new Uint8Array(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength,
          ),
          model,
        };
      } catch (err) {
        errors.push(
          `${model}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    throw new Error(`All models failed: ${errors.join("; ")}`);
  }
}

export function createFsRunnerIo(): RunnerIo {
  return {
    async readFile(filePath: string): Promise<Uint8Array> {
      const resolved = path.resolve(filePath);
      const buffer = await fs.promises.readFile(resolved);
      return new Uint8Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength,
      );
    },
    async writeFile(filePath: string, bytes: Uint8Array): Promise<void> {
      const resolved = path.resolve(filePath);
      await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
      await fs.promises.writeFile(resolved, bytes);
    },
  };
}

export function parseQueue(content: string): RegenJob[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(
      `Failed to parse queue JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !("jobs" in parsed) ||
    !Array.isArray((parsed as { jobs: unknown }).jobs)
  ) {
    throw new Error("Invalid queue format: expected object with 'jobs' array");
  }

  const rawJobs = (parsed as { jobs: unknown[] }).jobs;
  const jobs: RegenJob[] = [];

  for (const item of rawJobs) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid queue item: expected job object");
    }
    const jobObj = item as Record<string, unknown>;
    if (typeof jobObj.asset !== "string" || !jobObj.asset.trim()) {
      throw new Error("Invalid queue item: missing or invalid 'asset' field");
    }
    jobs.push(item as RegenJob);
  }

  return jobs;
}

export async function readQueueFile(queuePath: string): Promise<RegenJob[]> {
  const resolved = path.resolve(queuePath);
  let content: string;
  try {
    content = await fs.promises.readFile(resolved, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Queue file not found: ${resolved}`);
    }
    throw err;
  }
  return parseQueue(content);
}

export function defaultPromptFor(job: RegenJob): string | null {
  if (job.specRef && job.specRef.trim() !== "") {
    return `Regenerate clean artifact-free illustration for ${job.specRef}`;
  }
  if (job.asset && job.asset.trim() !== "") {
    return `Regenerate clean artifact-free illustration for ${job.asset}`;
  }
  return null;
}

export interface CliArgs {
  queueFile?: string;
  candidatesDir?: string;
  help?: boolean;
}

export function parseCliArgs(argv: readonly string[]): CliArgs {
  let queueFile: string | undefined;
  let candidatesDir: string | undefined;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--queue" && i + 1 < argv.length) {
      queueFile = argv[++i];
    } else if (arg.startsWith("--queue=")) {
      queueFile = arg.slice("--queue=".length);
    } else if (arg === "--candidates-dir" && i + 1 < argv.length) {
      candidatesDir = argv[++i];
    } else if (arg.startsWith("--candidates-dir=")) {
      candidatesDir = arg.slice("--candidates-dir=".length);
    }
  }

  return { queueFile, candidatesDir, help };
}

export interface RunImageCandidatesOptions {
  queueFile: string;
  candidatesDir?: string;
}

export async function runImageCandidates(
  options: RunImageCandidatesOptions,
): Promise<CandidateManifest> {
  const candidatesDir = options.candidatesDir ?? "candidates";
  const io = createFsRunnerIo();
  const client = new VertexImageClient();
  const promptFor = defaultPromptFor;

  const jobs = await readQueueFile(options.queueFile);
  return runImageRegeneration(jobs, {
    client,
    io,
    candidatesDir,
    promptFor,
  });
}

export async function main(
  argv: readonly string[] = process.argv.slice(2),
): Promise<number> {
  const args = parseCliArgs(argv);
  if (args.help) {
    console.log(
      "Usage: node tools/artifact_review/run_image_candidates.ts --queue <queue.json> [--candidates-dir <dir>]",
    );
    return 0;
  }

  if (!args.queueFile) {
    console.error("Error: missing required --queue argument");
    return 1;
  }

  const candidatesDir = args.candidatesDir ?? "candidates";

  try {
    const manifest = await runImageCandidates({
      queueFile: args.queueFile,
      candidatesDir,
    });

    const successes = manifest.filter((m) => m.status === "success").length;
    const errors = manifest.filter((m) => m.status === "error").length;
    const skipped = manifest.filter((m) => m.status === "skipped").length;
    console.log(
      `Processed ${manifest.length} jobs: ${successes} succeeded, ${errors} errors, ${skipped} skipped`,
    );

    return errors === 0 ? 0 : 1;
  } catch (err) {
    console.error(
      `Error executing image regeneration: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("run_image_candidates.ts")) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
