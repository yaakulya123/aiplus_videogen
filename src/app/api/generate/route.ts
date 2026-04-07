import { NextRequest, NextResponse } from "next/server";
import { Runware, type IRequestVideo } from "@runware/sdk-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, negativePrompt, model, width, height, duration } = body;

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

    const response = await runware.videoInference(params);

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
    const message =
      error instanceof Error ? error.message : "Failed to generate video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
