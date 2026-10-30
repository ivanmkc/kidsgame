import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  type GenerateImageRequest,
  type GenerateImageResponse,
  type ImageModelClient,
  type RunnerIo,
  mimeTypeFor,
  runImageRegeneration,
  validateCandidatePath,
} from "./regen_runner";
import {
  buildRegenQueue,
  type RegenJob,
  type VerdictExport,
} from "./regen_queue";

function createMemoryIo(initialFiles: Record<string, Uint8Array> = {}) {
  const files = new Map<string, Uint8Array>();
  for (const [p, content] of Object.entries(initialFiles)) {
    files.set(p.replace(/\\/g, "/"), content);
  }
  const writes = new Map<string, Uint8Array>();

  const io: RunnerIo = {
    async readFile(filePath: string): Promise<Uint8Array> {
      const norm = filePath.replace(/\\/g, "/");
      const data = files.get(norm);
      if (!data) {
        throw new Error(`File not found: ${filePath}`);
      }
      return data;
    },
    async writeFile(filePath: string, bytes: Uint8Array): Promise<void> {
      const norm = filePath.replace(/\\/g, "/");
      writes.set(norm, bytes);
      files.set(norm, bytes);
    },
  };

  return { io, files, writes };
}

function createFakeClient(
  impl?: (req: GenerateImageRequest) => Promise<GenerateImageResponse>,
) {
  const calls: GenerateImageRequest[] = [];
  const client: ImageModelClient = {
    async generateImage(req: GenerateImageRequest): Promise<GenerateImageResponse> {
      calls.push(req);
      if (impl) {
        return impl(req);
      }
      return {
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02]),
        model: req.model[0],
      };
    },
  };
  return { client, calls };
}

describe("mimeTypeFor", () => {
  it("identifies image mime types correctly from asset file extensions", () => {
    expect(mimeTypeFor("assets/foo.png")).toBe("image/png");
    expect(mimeTypeFor("assets/foo.jpg")).toBe("image/jpeg");
    expect(mimeTypeFor("assets/foo.jpeg")).toBe("image/jpeg");
    expect(mimeTypeFor("assets/foo.webp")).toBe("image/webp");
    expect(mimeTypeFor("assets/foo.bin")).toBe("image/png");
  });
});

describe("validateCandidatePath", () => {
  it("accepts safe relative asset paths under candidatesDir", () => {
    const res = validateCandidatePath(
      "candidates",
      "assets/game/story/acorn_a.jpg",
    );
    expect(res.safe).toBe(true);
    expect(res.candidatePath).toBe("candidates/assets/game/story/acorn_a.jpg");
  });

  it("rejects path traversal attempting to escape candidatesDir", () => {
    const res = validateCandidatePath("candidates", "../src/assets/x.png");
    expect(res.safe).toBe(false);
    expect(res.error).toContain("escapes candidates directory");
  });

  it("rejects absolute paths that point outside candidatesDir", () => {
    const res = validateCandidatePath("candidates", "/etc/passwd");
    expect(res.safe).toBe(false);
    expect(res.error).toContain("escapes candidates directory");
  });

  it("rejects candidate paths that match shipped asset path when candidatesDir is current dir", () => {
    const res = validateCandidatePath(".", "assets/game/story/acorn_a.jpg");
    expect(res.safe).toBe(false);
    expect(res.error).toContain("cannot overwrite shipped asset");
  });

  it("rejects empty inputs", () => {
    expect(validateCandidatePath("candidates", "").safe).toBe(false);
    expect(validateCandidatePath("", "assets/foo.png").safe).toBe(false);
  });
});

describe("runImageRegeneration", () => {
  it("writes one regenerated image under candidatesDir at relative path and never writes shipped asset path", async () => {
    const shippedAssetPath = "assets/game/story/acorn_a.jpg";
    const originalBytes = new Uint8Array([10, 20, 30]);
    const generatedBytes = new Uint8Array([99, 88, 77]);
    const prompt =
      "A cheerful squirrel holding an acorn in a sunlit forest clearing";

    const { io, writes } = createMemoryIo({
      [shippedAssetPath]: originalBytes,
    });
    const { client, calls } = createFakeClient(async (req) => ({
      bytes: generatedBytes,
      model: req.model[0],
    }));

    const jobs: RegenJob[] = [
      {
        asset: shippedAssetPath,
        mediaKind: "image",
        generator: "tools/gen_stories.py",
        specRef: "acorn",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
    ];

    const manifest = await runImageRegeneration(jobs, {
      client,
      io,
      candidatesDir: "candidates",
      promptFor: () => prompt,
    });

    // 1. Shipped asset was NEVER written
    expect(writes.has(shippedAssetPath)).toBe(false);

    // 2. Candidate image was written under candidatesDir at asset's relative path
    const expectedCandidatePath = "candidates/assets/game/story/acorn_a.jpg";
    expect(writes.has(expectedCandidatePath)).toBe(true);
    expect(writes.get(expectedCandidatePath)).toEqual(generatedBytes);

    // 3. Client was called with original asset as reference image, prompt from promptFor, and model from job
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      prompt,
      referenceImage: originalBytes,
      mimeType: "image/jpeg",
    });

    // 4. Manifest lists the successful candidate and writes candidates.json
    expect(manifest).toHaveLength(1);
    expect(manifest[0]).toEqual({
      assetPath: shippedAssetPath,
      candidatePath: expectedCandidatePath,
      model: "gemini-3-pro-image",
      status: "success",
    });

    expect(writes.has("candidates/candidates.json")).toBe(true);
    const savedJson = new TextDecoder().decode(
      writes.get("candidates/candidates.json"),
    );
    expect(JSON.parse(savedJson)).toEqual(manifest);
  });

  it("marks a job whose asset path escapes candidatesDir as error and writes nothing for it", async () => {
    const escapingPath = "../src/assets/x.png";
    const { io, writes } = createMemoryIo({
      [escapingPath]: new Uint8Array([1, 2, 3]),
    });
    const { client, calls } = createFakeClient();

    const jobs: RegenJob[] = [
      {
        asset: escapingPath,
        mediaKind: "image",
        generator: "tools/gen_escape.py",
        specRef: "room",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
    ];

    const manifest = await runImageRegeneration(jobs, {
      client,
      io,
      candidatesDir: "candidates",
      promptFor: () => "Clean room scene without artifacts",
    });

    // 1. Status is error and candidatePath is null
    expect(manifest).toHaveLength(1);
    expect(manifest[0].status).toBe("error");
    expect(manifest[0].candidatePath).toBeNull();
    expect(manifest[0].reason).toContain("escapes candidates directory");

    // 2. Nothing is written for the escaped path or as an image
    expect(calls).toHaveLength(0);
    expect(writes.has(escapingPath)).toBe(false);
    expect(
      writes.has(path.join("candidates", escapingPath).replace(/\\/g, "/")),
    ).toBe(false);
    expect(writes.has("src/assets/x.png")).toBe(false);

    // Only candidates.json was written to record the run manifest
    expect(Array.from(writes.keys())).toEqual(["candidates/candidates.json"]);
  });

  it("skips video jobs, jobs with no known generator, and jobs with no prompt with reasons without calling fake client", async () => {
    const { io, writes } = createMemoryIo();
    const { client, calls } = createFakeClient();

    const jobs: RegenJob[] = [
      {
        asset: "public/story-video/luna_start_0.mp4",
        mediaKind: "video",
        generator: "tools/gen_story_videos.py",
        specRef: "luna",
        model: ["veo-3.1-fast-generate-001"],
      },
      {
        asset: "assets/game/unknown/orphan.png",
        mediaKind: "image",
        generator: "",
        specRef: "",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
      {
        asset: "assets/game/story/acorn_a.jpg",
        mediaKind: "image",
        generator: "tools/gen_stories.py",
        specRef: "acorn",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
    ];

    const manifest = await runImageRegeneration(jobs, {
      client,
      io,
      candidatesDir: "candidates",
      promptFor: (job) => (job.asset.includes("acorn") ? null : "Some prompt"),
    });

    // Client is never called
    expect(calls).toHaveLength(0);

    // All jobs get status 'skipped' with appropriate reasons
    expect(manifest).toHaveLength(3);

    expect(manifest[0]).toEqual({
      assetPath: "public/story-video/luna_start_0.mp4",
      candidatePath: null,
      model: ["veo-3.1-fast-generate-001"],
      status: "skipped",
      reason: "Video jobs belong to R6",
    });

    expect(manifest[1]).toEqual({
      assetPath: "assets/game/unknown/orphan.png",
      candidatePath: null,
      model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      status: "skipped",
      reason: "No known generator for asset",
    });

    expect(manifest[2]).toEqual({
      assetPath: "assets/game/story/acorn_a.jpg",
      candidatePath: null,
      model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      status: "skipped",
      reason: "No prompt for asset",
    });

    // No media files written
    expect(writes.has("public/story-video/luna_start_0.mp4")).toBe(false);
    expect(writes.has("assets/game/unknown/orphan.png")).toBe(false);
    expect(writes.has("assets/game/story/acorn_a.jpg")).toBe(false);
    expect(writes.has("candidates/public/story-video/luna_start_0.mp4")).toBe(
      false,
    );
    expect(writes.has("candidates/assets/game/unknown/orphan.png")).toBe(false);
    expect(writes.has("candidates/assets/game/story/acorn_a.jpg")).toBe(false);
  });

  it("marks a rejected client call as error while later jobs succeed and candidates.json lists all jobs with models", async () => {
    const job1Asset = "assets/game/story/acorn_a.jpg";
    const job2Asset = "assets/game/story/acorn_b.jpg";
    const job3Video = "public/story-video/luna_start_0.mp4";

    const { io, writes } = createMemoryIo({
      [job1Asset]: new Uint8Array([1]),
      [job2Asset]: new Uint8Array([2]),
    });

    let callCount = 0;
    const { client } = createFakeClient(async (req) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Vertex API 429 quota exhausted");
      }
      return {
        bytes: new Uint8Array([42]),
        model: req.model[0],
      };
    });

    const jobs: RegenJob[] = [
      {
        asset: job1Asset,
        mediaKind: "image",
        generator: "tools/gen_stories.py",
        specRef: "acorn",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
      {
        asset: job2Asset,
        mediaKind: "image",
        generator: "tools/gen_stories.py",
        specRef: "acorn",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
      {
        asset: job3Video,
        mediaKind: "video",
        generator: "tools/gen_story_videos.py",
        specRef: "luna",
        model: ["veo-3.1-fast-generate-001"],
      },
    ];

    const manifest = await runImageRegeneration(jobs, {
      client,
      io,
      candidatesDir: "candidates",
      promptFor: (job) => `Prompt for ${job.asset}`,
    });

    expect(manifest).toHaveLength(3);

    // Job 1 failed in client call
    expect(manifest[0].assetPath).toBe(job1Asset);
    expect(manifest[0].status).toBe("error");
    expect(manifest[0].candidatePath).toBeNull();
    expect(manifest[0].model).toEqual([
      "gemini-3-pro-image",
      "gemini-nano-banana-2.1",
    ]);
    expect(manifest[0].reason).toContain("Vertex API 429 quota exhausted");

    // Job 2 succeeded despite Job 1 failure
    expect(manifest[1].assetPath).toBe(job2Asset);
    expect(manifest[1].status).toBe("success");
    expect(manifest[1].candidatePath).toBe(
      "candidates/assets/game/story/acorn_b.jpg",
    );
    expect(manifest[1].model).toBe("gemini-3-pro-image");

    // Job 3 was skipped
    expect(manifest[2].assetPath).toBe(job3Video);
    expect(manifest[2].status).toBe("skipped");
    expect(manifest[2].candidatePath).toBeNull();
    expect(manifest[2].model).toEqual(["veo-3.1-fast-generate-001"]);

    // candidates.json lists every job with model id taken from job
    expect(writes.has("candidates/candidates.json")).toBe(true);
    const saved = JSON.parse(
      new TextDecoder().decode(writes.get("candidates/candidates.json")),
    );
    expect(saved).toEqual(manifest);
    expect(saved[0].model).toEqual([
      "gemini-3-pro-image",
      "gemini-nano-banana-2.1",
    ]);
    expect(saved[1].model).toBe("gemini-3-pro-image");
    expect(saved[2].model).toEqual(["veo-3.1-fast-generate-001"]);
  });

  it("marks job as error if reference asset cannot be read from io", async () => {
    const { io } = createMemoryIo({}); // empty io - file will not exist
    const { client, calls } = createFakeClient();

    const jobs: RegenJob[] = [
      {
        asset: "assets/game/missing.png",
        mediaKind: "image",
        generator: "tools/gen_dressup.py",
        specRef: "",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
    ];

    const manifest = await runImageRegeneration(jobs, {
      client,
      io,
      candidatesDir: "candidates",
      promptFor: () => "Dressup crown",
    });

    expect(manifest[0].status).toBe("error");
    expect(manifest[0].candidatePath).toBeNull();
    expect(manifest[0].reason).toContain("Failed to read reference asset");
    expect(calls).toHaveLength(0);
  });

  it("marks job as error if candidate file cannot be written to io", async () => {
    const { io } = createMemoryIo({
      "assets/game/foo.png": new Uint8Array([1]),
    });
    const { client } = createFakeClient();

    // Mock writeFile to fail on image write
    vi.spyOn(io, "writeFile").mockImplementation(async (targetPath: string) => {
      if (targetPath.endsWith(".png")) {
        throw new Error("Disk full");
      }
    });

    const jobs: RegenJob[] = [
      {
        asset: "assets/game/foo.png",
        mediaKind: "image",
        generator: "tools/gen_dressup.py",
        specRef: "",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
    ];

    const manifest = await runImageRegeneration(jobs, {
      client,
      io,
      candidatesDir: "candidates",
      promptFor: () => "Dressup hat",
    });

    expect(manifest[0].status).toBe("error");
    expect(manifest[0].candidatePath).toBeNull();
    expect(manifest[0].reason).toContain(
      "Failed to write candidate asset: Disk full",
    );
  });

  it("runs jobs constructed end-to-end from review verdicts via buildRegenQueue", async () => {
    const verdicts: VerdictExport = [
      { path: "assets/game/story/acorn_a.jpg", verdict: "regenerate" },
      { path: "public/story-video/luna_start_0.mp4", verdict: "regenerate" },
      { path: "assets/game/escape/toyroom_clean.png", verdict: "keep" },
    ];

    const { jobs, unmatched } = buildRegenQueue(verdicts);
    expect(unmatched).toEqual([]);
    expect(jobs).toHaveLength(2);

    const { io, writes } = createMemoryIo({
      "assets/game/story/acorn_a.jpg": new Uint8Array([1, 2]),
    });
    const { client } = createFakeClient();

    // The queue-built image job runs directly without patching 'prompt' onto the job
    const manifest = await runImageRegeneration(jobs, {
      client,
      io,
      candidatesDir: "candidates",
      promptFor: (job) =>
        job.specRef
          ? `Acorn story illustration for ${job.specRef} in picture-book style`
          : null,
    });

    expect(manifest).toHaveLength(2);

    const imageEntry = manifest.find(
      (c) => c.assetPath === "assets/game/story/acorn_a.jpg",
    );
    expect(imageEntry?.status).toBe("success");
    expect(imageEntry?.candidatePath).toBe(
      "candidates/assets/game/story/acorn_a.jpg",
    );

    const videoEntry = manifest.find(
      (c) => c.assetPath === "public/story-video/luna_start_0.mp4",
    );
    expect(videoEntry?.status).toBe("skipped");
    expect(videoEntry?.reason).toContain("Video jobs belong to R6");

    expect(writes.has("candidates/assets/game/story/acorn_a.jpg")).toBe(true);
    expect(writes.has("candidates/candidates.json")).toBe(true);
  });
});
