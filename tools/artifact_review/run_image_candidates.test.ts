import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VertexImageClient,
  createFsRunnerIo,
  defaultPromptFor,
  main,
  parseCliArgs,
  parseQueue,
  readQueueFile,
  runImageCandidates,
} from "./run_image_candidates";
import { type RegenJob } from "./regen_queue";

describe("parseCliArgs", () => {
  it("parses separate flag and value arguments", () => {
    const args = parseCliArgs([
      "--queue",
      "queue.json",
      "--candidates-dir",
      "out_dir",
    ]);
    expect(args.queueFile).toBe("queue.json");
    expect(args.candidatesDir).toBe("out_dir");
  });

  it("parses equals-style arguments", () => {
    const args = parseCliArgs(["--queue=q.json", "--candidates-dir=cands"]);
    expect(args.queueFile).toBe("q.json");
    expect(args.candidatesDir).toBe("cands");
  });

  it("detects help flags", () => {
    expect(parseCliArgs(["--help"]).help).toBe(true);
    expect(parseCliArgs(["-h"]).help).toBe(true);
    expect(parseCliArgs(["--queue", "q.json"]).help).toBe(false);
  });
});

describe("parseQueue and readQueueFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "queue-test-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("parses an object with jobs array", () => {
    const payload = {
      jobs: [
        {
          asset: "assets/game/story/acorn_a.jpg",
          mediaKind: "image",
          generator: "tools/gen_stories.py",
          specRef: "acorn",
          model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
        },
      ],
    };
    const parsed = parseQueue(JSON.stringify(payload));
    expect(parsed).toEqual(payload.jobs);
  });

  it("handles empty jobs array in queue object", () => {
    expect(parseQueue('{"jobs": []}')).toEqual([]);
  });

  it("rejects bare arrays as invalid queue format", () => {
    expect(() => parseQueue("[]")).toThrow(
      "Invalid queue format: expected object with 'jobs' array",
    );
    expect(() =>
      parseQueue(
        JSON.stringify([
          {
            asset: "assets/game/story/acorn_a.jpg",
            mediaKind: "image",
            generator: "tools/gen_stories.py",
            specRef: "acorn",
            model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
          },
        ]),
      ),
    ).toThrow("Invalid queue format: expected object with 'jobs' array");
  });

  it("rejects raw verdicts export as invalid queue format", () => {
    const verdicts = [
      { path: "assets/game/story/acorn_a.jpg", verdict: "regenerate" },
      { path: "assets/game/escape/toyroom.png", verdict: "keep" },
    ];
    expect(() => parseQueue(JSON.stringify(verdicts))).toThrow(
      "Invalid queue format: expected object with 'jobs' array",
    );
  });

  it("throws descriptive error on malformed JSON", () => {
    expect(() => parseQueue("{ not valid json")).toThrow(
      "Failed to parse queue JSON",
    );
  });

  it("throws descriptive error on invalid queue structure", () => {
    expect(() => parseQueue('"a string"')).toThrow(
      "Invalid queue format: expected object with 'jobs' array",
    );
    expect(() => parseQueue('{"otherKey": 123}')).toThrow(
      "Invalid queue format: expected object with 'jobs' array",
    );
    expect(() => parseQueue('{"jobs": "not an array"}')).toThrow(
      "Invalid queue format: expected object with 'jobs' array",
    );
  });

  it("throws descriptive error on invalid job item", () => {
    expect(() => parseQueue('{"jobs": [null]}')).toThrow(
      "Invalid queue item: expected job object",
    );
    expect(() => parseQueue('{"jobs": ["not an object"]}')).toThrow(
      "Invalid queue item: expected job object",
    );
    expect(() => parseQueue('{"jobs": [{}]}')).toThrow(
      "Invalid queue item: missing or invalid 'asset' field",
    );
    expect(() => parseQueue('{"jobs": [{"asset": ""}]}')).toThrow(
      "Invalid queue item: missing or invalid 'asset' field",
    );
  });

  it("readQueueFile reads file and parses content", async () => {
    const qFile = path.join(tmpDir, "queue.json");
    const jobs = [
      {
        asset: "assets/game/dressup/hat.png",
        mediaKind: "image",
        generator: "tools/gen_dressup.py",
        specRef: "",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
    ];
    await fs.promises.writeFile(qFile, JSON.stringify({ jobs }));

    const result = await readQueueFile(qFile);
    expect(result).toEqual(jobs);
  });

  it("readQueueFile throws if file does not exist", async () => {
    await expect(
      readQueueFile(path.join(tmpDir, "non_existent.json")),
    ).rejects.toThrow("Queue file not found");
  });
});

describe("defaultPromptFor", () => {
  it("generates prompt from specRef", () => {
    const job: RegenJob = {
      asset: "assets/game/story/acorn_a.jpg",
      mediaKind: "image",
      generator: "tools/gen_stories.py",
      specRef: "acorn",
      model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
    };
    expect(defaultPromptFor(job)).toContain("acorn");
  });

  it("generates prompt from asset if specRef is empty", () => {
    const job: RegenJob = {
      asset: "assets/game/dressup/hat.png",
      mediaKind: "image",
      generator: "tools/gen_dressup.py",
      specRef: "",
      model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
    };
    expect(defaultPromptFor(job)).toContain("assets/game/dressup/hat.png");
  });

  it("returns null if both specRef and asset are empty", () => {
    const job: RegenJob = {
      asset: "",
      mediaKind: "image",
      generator: "tools/gen_dressup.py",
      specRef: "",
      model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
    };
    expect(defaultPromptFor(job)).toBeNull();
  });
});

describe("createFsRunnerIo", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "io-test-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("reads and writes files, creating nested directories as needed", async () => {
    const io = createFsRunnerIo();
    const filePath = path.join(tmpDir, "nested/dir/candidate.png");
    const data = new Uint8Array([1, 2, 3, 4]);

    await io.writeFile(filePath, data);

    const read = await io.readFile(filePath);
    expect(read).toEqual(data);
  });
});

describe("VertexImageClient", () => {
  const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  const fakeBase64 = Buffer.from(fakePng).toString("base64");
  let originalToken: string | undefined;
  let originalProject: string | undefined;

  beforeEach(() => {
    originalToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    originalProject = process.env.GOOGLE_CLOUD_PROJECT;
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.GOOGLE_OAUTH_ACCESS_TOKEN = originalToken;
    } else {
      delete process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    }
    if (originalProject !== undefined) {
      process.env.GOOGLE_CLOUD_PROJECT = originalProject;
    } else {
      delete process.env.GOOGLE_CLOUD_PROJECT;
    }
    vi.restoreAllMocks();
  });

  it("throws if no access token is available", async () => {
    delete process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    const client = new VertexImageClient();
    await expect(
      client.generateImage({
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
        prompt: "test prompt",
        mimeType: "image/png",
      }),
    ).rejects.toThrow(
      "GOOGLE_OAUTH_ACCESS_TOKEN environment variable is required",
    );
  });

  it("sends correct REST request and parses image bytes from response", async () => {
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN = "fake-token-123";
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";

    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: unknown;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      capturedBody = JSON.parse(init?.body as string);

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: "image/png",
                        data: fakeBase64,
                      },
                    },
                  ],
                },
              },
            ],
          };
        },
      } as unknown as Response;
    });

    const client = new VertexImageClient();
    const refImage = new Uint8Array([10, 20, 30]);
    const response = await client.generateImage({
      model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      prompt: "A cute squirrel",
      referenceImage: refImage,
      mimeType: "image/jpeg",
    });

    expect(response.bytes).toEqual(fakePng);
    expect(response.model).toBe("gemini-3-pro-image");
    expect(capturedUrl).toBe(
      "https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/publishers/google/models/gemini-3-pro-image:generateContent",
    );
    expect(capturedHeaders["Authorization"]).toBe("Bearer fake-token-123");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");

    const bodyObj = capturedBody as {
      contents: Array<{
        parts: Array<{
          text?: string;
          inlineData?: { mimeType: string; data: string };
        }>;
      }>;
      generationConfig: { responseModalities: string[] };
    };
    expect(bodyObj.generationConfig.responseModalities).toEqual(["IMAGE"]);
    expect(bodyObj.contents[0].parts[0].text).toBe("A cute squirrel");
    expect(bodyObj.contents[0].parts[1].inlineData?.mimeType).toBe(
      "image/jpeg",
    );
    expect(bodyObj.contents[0].parts[1].inlineData?.data).toBe(
      Buffer.from(refImage).toString("base64"),
    );
  });

  it("tries the fallback model when the primary model fails", async () => {
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN = "test-token";
    let callCount = 0;
    const capturedUrls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (url: string | Request | URL) => {
        callCount++;
        capturedUrls.push(url.toString());
        if (callCount === 1) {
          return {
            ok: false,
            status: 500,
            text: async () => "Internal Server Error",
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    { inlineData: { mimeType: "image/png", data: fakeBase64 } },
                  ],
                },
              },
            ],
          }),
        } as Response;
      },
    );

    const client = new VertexImageClient();
    const response = await client.generateImage({
      model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      prompt: "A cute squirrel",
      mimeType: "image/jpeg",
    });

    expect(response.bytes).toEqual(fakePng);
    expect(response.model).toBe("gemini-nano-banana-2.1");
    expect(callCount).toBe(2);
    expect(capturedUrls[0]).toContain("gemini-3-pro-image");
    expect(capturedUrls[1]).toContain("gemini-nano-banana-2.1");
  });

  it("throws descriptive error when HTTP response status is not ok", async () => {
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN = "test-token";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      async text() {
        return "Rate quota exceeded";
      },
    } as unknown as Response);

    const client = new VertexImageClient();

    await expect(
      client.generateImage({
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
        prompt: "test prompt",
        mimeType: "image/png",
      }),
    ).rejects.toThrow("Vertex AI HTTP 429: Rate quota exceeded");
  });

  it("throws descriptive error when response has no image data", async () => {
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN = "test-token";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      async json() {
        return {
          candidates: [{ content: { parts: [{ text: "Here is text only" }] } }],
        };
      },
    } as unknown as Response);

    const client = new VertexImageClient();

    await expect(
      client.generateImage({
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
        prompt: "test prompt",
        mimeType: "image/png",
      }),
    ).rejects.toThrow("Vertex AI response contained no image data");
  });

  it("propagates network failure from fetch", async () => {
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN = "test-token";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed"),
    );

    const client = new VertexImageClient();

    await expect(
      client.generateImage({
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
        prompt: "test prompt",
        mimeType: "image/png",
      }),
    ).rejects.toThrow("fetch failed");
  });
});

describe("CLI execution and network error handling", () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalToken: string | undefined;
  const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01]);
  const fakeBase64 = Buffer.from(fakePng).toString("base64");

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cli-test-"));
    process.chdir(tmpDir);
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN = "fake-token";
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (originalToken !== undefined) {
      process.env.GOOGLE_OAUTH_ACCESS_TOKEN = originalToken;
    } else {
      delete process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    }
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("successfully generates candidate images and manifest when HTTP client succeeds", async () => {
    const assetRelPath = "assets/game/story/acorn_a.jpg";
    await fs.promises.mkdir(path.dirname(assetRelPath), { recursive: true });
    await fs.promises.writeFile(assetRelPath, new Uint8Array([11, 22, 33]));

    const jobs: RegenJob[] = [
      {
        asset: assetRelPath,
        mediaKind: "image",
        generator: "tools/gen_stories.py",
        specRef: "acorn",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
    ];
    await fs.promises.writeFile("queue.json", JSON.stringify({ jobs }));

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: fakeBase64,
                    },
                  },
                ],
              },
            },
          ],
        };
      },
    } as unknown as Response);

    const manifest = await runImageCandidates({
      queueFile: "queue.json",
      candidatesDir: "test_cands",
    });

    expect(manifest).toHaveLength(1);
    expect(manifest[0].status).toBe("success");
    expect(manifest[0].model).toBe("gemini-3-pro-image");
    expect(manifest[0].candidatePath).toBe(
      "test_cands/assets/game/story/acorn_a.jpg",
    );

    // Verify written candidate file
    const candFilePath = path.join("test_cands", assetRelPath);
    expect(fs.existsSync(candFilePath)).toBe(true);
    const writtenBytes = await fs.promises.readFile(candFilePath);
    expect(writtenBytes).toEqual(Buffer.from(fakePng));

    // Verify candidates.json
    const manifestFile = path.join("test_cands", "candidates.json");
    expect(fs.existsSync(manifestFile)).toBe(true);
    const manifestJson = JSON.parse(
      await fs.promises.readFile(manifestFile, "utf-8"),
    );
    expect(manifestJson).toEqual(manifest);
  });

  it("handles network error in HTTP client gracefully, writing error to manifest and returning 1 from main", async () => {
    const assetRelPath = "assets/game/story/acorn_a.jpg";
    await fs.promises.mkdir(path.dirname(assetRelPath), { recursive: true });
    await fs.promises.writeFile(assetRelPath, new Uint8Array([11, 22, 33]));

    const jobs: RegenJob[] = [
      {
        asset: assetRelPath,
        mediaKind: "image",
        generator: "tools/gen_stories.py",
        specRef: "acorn",
        model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      },
    ];
    await fs.promises.writeFile("queue.json", JSON.stringify({ jobs }));

    // Simulate network error in fetch
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("network connection failed"),
    );

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const exitCode = await main([
      "--queue",
      "queue.json",
      "--candidates-dir",
      "test_cands",
    ]);

    // main should return 1 because error occurred
    expect(exitCode).toBe(1);

    // Verify candidates.json was still written and recorded the network error
    const manifestFile = path.join("test_cands", "candidates.json");
    expect(fs.existsSync(manifestFile)).toBe(true);
    const manifestJson = JSON.parse(
      await fs.promises.readFile(manifestFile, "utf-8"),
    );
    expect(manifestJson).toHaveLength(1);
    expect(manifestJson[0].status).toBe("error");
    expect(manifestJson[0].reason).toContain(
      "Model generation failed: All models failed: gemini-3-pro-image: network connection failed; gemini-nano-banana-2.1: network connection failed",
    );
  });

  it("main returns 0 on --help", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await main(["--help"]);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalled();
  });

  it("main returns 1 when --queue argument is missing", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await main([]);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing required --queue argument"),
    );
  });

  it("main returns 1 when queue file does not exist", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await main(["--queue", "missing_queue.json"]);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("Queue file not found"),
    );
  });
});
