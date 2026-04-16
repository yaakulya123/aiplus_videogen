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
    let message = "Failed to generate video";
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "object" && error !== null) {
      message = JSON.stringify(error);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
