import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const RUNWARE_ENDPOINT = "https://api.runware.ai/v1";

// Submit a video generation task and return a task UUID immediately. The
// actual generation runs on Runware's side; the client polls /api/status to
// get the result. This keeps the serverless function short (2-5s) instead of
// holding the connection open for the 1-3 minutes Runware needs.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, negativePrompt, model, width, height, duration, seedImage, lastFrameImage } = body;

    if (!prompt || !model) {
      return NextResponse.json({ error: "Prompt and model are required" }, { status: 400 });
    }

    const apiKey = process.env.RUNWARE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const task: Record<string, unknown> = {
      taskType: "videoInference",
      taskUUID: crypto.randomUUID(),
      deliveryMethod: "async",
      model,
      positivePrompt: prompt,
      duration: duration || 5,
    };
    // width/height are optional — some models (e.g. Kling with frameImages)
    // reject them and infer dimensions from the uploaded image.
    if (typeof width === "number") task.width = width;
    if (typeof height === "number") task.height = height;
    if (negativePrompt) task.negativePrompt = negativePrompt;
    if (seedImage || lastFrameImage) {
      const frameImages: { image: string; frame: string }[] = [];
      if (seedImage) frameImages.push({ image: seedImage, frame: "first" });
      if (lastFrameImage) frameImages.push({ image: lastFrameImage, frame: "last" });
      task.inputs = { frameImages };
    }

    const result = await submitWithFallbacks(apiKey, task);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ taskUUID: result.taskUUID });
  } catch (error: unknown) {
    console.error("Video submission error:", error);
    const message = error instanceof Error ? error.message : "Failed to submit video task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ApiError = {
  code?: string;
  message?: string;
  parameter?: unknown;
  allowedValues?: unknown;
  taskUUID?: string;
};

async function submitTask(
  apiKey: string,
  task: Record<string, unknown>
): Promise<{ taskUUID: string } | { apiError: ApiError }> {
  const res = await fetch(RUNWARE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify([task]),
  });
  const json = (await res.json()) as {
    data?: { taskUUID?: string }[];
    errors?: ApiError[];
  };
  if (json.errors?.length) return { apiError: json.errors[0] };
  const entry = json.data?.[0];
  if (entry?.taskUUID) return { taskUUID: entry.taskUUID };
  return { apiError: { message: "Runware returned no task UUID" } };
}

// Auto-fix known submission errors by adjusting the task and retrying once:
//   - unsupportedModelResolution: pick the closest allowed width/height
//   - unsupportedParameter on negativePrompt: strip it (some models don't
//     accept negative prompts, e.g. Seedance)
async function submitWithFallbacks(
  apiKey: string,
  task: Record<string, unknown>
): Promise<{ taskUUID: string } | { error: string }> {
  const first = await submitTask(apiKey, task);
  if ("taskUUID" in first) return first;

  const err = first.apiError;

  // Resolution mismatch → pick closest allowed pair
  if (
    err.code === "unsupportedModelResolution" &&
    typeof task.width === "number" &&
    typeof task.height === "number"
  ) {
    const allowed = parseAllowedResolutions(err.allowedValues);
    const best = allowed.length
      ? pickClosestResolution(task.width, task.height, allowed)
      : null;
    if (best) {
      task.width = best.width;
      task.height = best.height;
      const retry = await submitTask(apiKey, task);
      if ("taskUUID" in retry) return retry;
      return { error: retry.apiError.message || "Failed to submit task" };
    }
  }

  // Unsupported negativePrompt → drop it and retry
  if (isParamError(err, "negativePrompt") && task.negativePrompt) {
    delete task.negativePrompt;
    const retry = await submitTask(apiKey, task);
    if ("taskUUID" in retry) return retry;
    return { error: retry.apiError.message || "Failed to submit task" };
  }

  return { error: err.message || err.code || "Failed to submit task" };
}

function isParamError(err: ApiError, paramName: string): boolean {
  if (err.code !== "unsupportedParameter") return false;
  const p = err.parameter;
  if (p === paramName) return true;
  if (Array.isArray(p) && p.includes(paramName)) return true;
  if (typeof err.message === "string" && err.message.includes(`'${paramName}'`))
    return true;
  return false;
}

function parseAllowedResolutions(raw: unknown): { width: number; height: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { width: number; height: number }[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const m = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(entry.trim());
    if (!m) continue;
    out.push({ width: Number(m[1]), height: Number(m[2]) });
  }
  return out;
}

function pickClosestResolution(
  w: number,
  h: number,
  allowed: { width: number; height: number }[]
) {
  const targetAR = w / h;
  const targetArea = w * h;
  const sameAspect = allowed.filter(
    (r) => Math.abs(r.width / r.height - targetAR) / targetAR < 0.02
  );
  const pool = sameAspect.length ? sameAspect : allowed;
  let best: { width: number; height: number } | null = null;
  let bestScore = Infinity;
  for (const r of pool) {
    const arPenalty = Math.abs(r.width / r.height - targetAR);
    const areaPenalty = Math.abs(r.width * r.height - targetArea);
    const score = arPenalty * 1e12 + areaPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}
