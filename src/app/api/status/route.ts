import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const RUNWARE_ENDPOINT = "https://api.runware.ai/v1";

// Poll Runware for a previously-submitted task. The client calls this on a
// loop until status becomes "success" or "error". Each call finishes in
// ~1 second so we never hit serverless timeouts.
export async function GET(req: NextRequest) {
  const uuid = req.nextUrl.searchParams.get("uuid");
  if (!uuid) {
    return NextResponse.json({ error: "uuid is required" }, { status: 400 });
  }

  const apiKey = process.env.RUNWARE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(RUNWARE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify([{ taskType: "getResponse", taskUUID: uuid }]),
    });

    const json = (await res.json()) as {
      data?: {
        taskUUID?: string;
        status?: string;
        videoURL?: string;
      }[];
      errors?: { taskUUID?: string; message?: string; code?: string }[];
    };

    if (json.errors?.length) {
      const match = json.errors.find((e) => e.taskUUID === uuid) ?? json.errors[0];
      return NextResponse.json({
        status: "error",
        error: match.message || match.code || "Generation failed",
      });
    }

    const entry = json.data?.find((e) => e.taskUUID === uuid) ?? json.data?.[0];
    if (!entry) {
      return NextResponse.json({ status: "processing" });
    }

    if (entry.status === "processing") {
      return NextResponse.json({ status: "processing" });
    }
    if (entry.status === "success" && entry.videoURL) {
      return NextResponse.json({ status: "success", videoURL: entry.videoURL });
    }
    // Unknown status — keep the client polling rather than failing hard.
    return NextResponse.json({ status: "processing" });
  } catch (error: unknown) {
    console.error("Video status error:", error);
    const message = error instanceof Error ? error.message : "Status check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
