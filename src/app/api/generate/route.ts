import { NextRequest, NextResponse } from "next/server";
import { Runware, type IRequestVideo } from "@runware/sdk-js";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, negativePrompt, model, width, height, duration, seedImage, lastFrameImage } = body;

    if (!prompt || !model) {
      return NextResponse.json(
        { error: "Prompt and model are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RUNWARE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const runware = new Runware({ apiKey });
    await runware.ensureConnection();

    const params: IRequestVideo = {
      positivePrompt: prompt,
      model,
      width: width || 1280,
      height: height || 720,
      duration: duration || 5,
      ...(negativePrompt ? { negativePrompt } : {}),
    };

    // Add frame images for image-to-video — sent as a top-level parameter,
    // not wrapped in `inputs` (the API rejects `inputs` for video models).
    if (seedImage || lastFrameImage) {
      const frameImages: { image: string; frame: string }[] = [];
      if (seedImage) {
        frameImages.push({ image: seedImage, frame: "first" });
      }
      if (lastFrameImage) {
        frameImages.push({ image: lastFrameImage, frame: "last" });
      }
      params.frameImages = frameImages;
    }

    const response = await inferWithResolutionFallback(runware, params);

    if (response) {
      const video = Array.isArray(response) ? response[0] : response;
      return NextResponse.json({
        videoURL: (video as { videoURL?: string }).videoURL,
        taskUUID: (video as { taskUUID?: string }).taskUUID,
      });
    }

    return NextResponse.json(
      { error: "No video was generated. Please try again." },
      { status: 500 }
    );
  } catch (error: unknown) {
    console.error("Video generation error:", error);
    const message = friendlyError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Each Runware video model has a hard-coded list of accepted width/height
// pairs. If the UI sends a pair that isn't in that list, the API replies with
// `unsupportedModelResolution` and returns the full allowed list. Rather than
// try to keep 28 models' resolution tables in perfect sync, we catch that one
// error, pick the allowed resolution closest to what the user asked for
// (preferring the same aspect ratio), and retry once.
async function inferWithResolutionFallback(
  runware: InstanceType<typeof Runware>,
  params: IRequestVideo
) {
  try {
    return await runware.videoInference(params);
  } catch (err) {
    const data = extractApiError(err);
    if (data?.code !== "unsupportedModelResolution") throw err;

    const allowed = parseAllowedResolutions(data.allowedValues);
    if (!allowed.length) throw err;

    const best = pickClosestResolution(params.width!, params.height!, allowed);
    if (!best) throw err;

    params.width = best.width;
    params.height = best.height;
    return await runware.videoInference(params);
  }
}

type ApiError = {
  code?: string;
  message?: string;
  allowedValues?: unknown;
};

function extractApiError(err: unknown): ApiError | null {
  if (typeof err !== "object" || err === null) return null;
  const candidate = (err as { error?: unknown }).error ?? err;
  if (typeof candidate !== "object" || candidate === null) return null;
  return candidate as ApiError;
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

  // Prefer same-aspect matches (within 2% tolerance). If none, fall back to
  // the overall closest match. Within a group, pick the one closest in pixel
  // area to what the user asked for.
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

function friendlyError(err: unknown): string {
  const data = extractApiError(err);
  if (data?.message && typeof data.message === "string") return data.message;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) return JSON.stringify(err);
  return "Failed to generate video";
}
