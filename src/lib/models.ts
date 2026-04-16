export interface VideoModel {
  id: string;
  name: string;
  provider: string;
  tagline: string;
  minDuration: number;
  maxDuration: number;
  durationStep: number;
  resolutions: { label: string; width: number; height: number }[];
  supportsImageToVideo: boolean;
  supportsLastFrame: boolean;
  // When true, the API rejects explicit width/height once `inputs.frameImages`
  // is provided — output dimensions are inferred from the uploaded image.
  // True for KlingAI models.
  imageInheritsResolution?: boolean;
}

// Curated from Runware's per-model docs. Resolutions are the exact
// width/height pairs each model accepts — any other pair is rejected by the
// API. All listed models accept image-to-video input via `inputs.frameImages`.
export const VIDEO_MODELS: VideoModel[] = [
  {
    id: "google:3@0",
    name: "Veo 3",
    provider: "Google",
    tagline: "Highest overall quality, native audio",
    minDuration: 8,
    maxDuration: 8,
    durationStep: 1,
    resolutions: [
      { label: "1080p Landscape (16:9)", width: 1920, height: 1080 },
      { label: "720p Landscape (16:9)", width: 1280, height: 720 },
      { label: "1080p Portrait (9:16)", width: 1080, height: 1920 },
      { label: "720p Portrait (9:16)", width: 720, height: 1280 },
    ],
    supportsImageToVideo: true,
    supportsLastFrame: false,
  },
  {
    id: "google:3@1",
    name: "Veo 3 Fast",
    provider: "Google",
    tagline: "Veo 3 quality at half the cost, supports last frame",
    minDuration: 8,
    maxDuration: 8,
    durationStep: 1,
    resolutions: [
      { label: "1080p Landscape (16:9)", width: 1920, height: 1080 },
      { label: "720p Landscape (16:9)", width: 1280, height: 720 },
      { label: "1080p Portrait (9:16)", width: 1080, height: 1920 },
      { label: "720p Portrait (9:16)", width: 720, height: 1280 },
    ],
    supportsImageToVideo: true,
    supportsLastFrame: true,
  },
  {
    id: "klingai:kling-video@2.6-pro",
    name: "Kling 2.6 Pro",
    provider: "KlingAI",
    tagline: "Cinematic realism with strong motion",
    minDuration: 5,
    maxDuration: 10,
    durationStep: 5,
    resolutions: [
      { label: "1080p Landscape (16:9)", width: 1920, height: 1080 },
      { label: "1080p Portrait (9:16)", width: 1080, height: 1920 },
      { label: "1080p Square (1:1)", width: 1080, height: 1080 },
    ],
    supportsImageToVideo: true,
    supportsLastFrame: true,
    imageInheritsResolution: true,
  },
  {
    id: "bytedance:seedance@1.5-pro",
    name: "Seedance 1.5 Pro",
    provider: "ByteDance",
    tagline: "Best price-to-quality, widest aspect ratios",
    minDuration: 3,
    maxDuration: 10,
    durationStep: 1,
    resolutions: [
      { label: "1080p Landscape (16:9)", width: 1920, height: 1080 },
      { label: "720p Landscape (16:9)", width: 1280, height: 720 },
      { label: "1080p Portrait (9:16)", width: 1080, height: 1920 },
      { label: "720p Portrait (9:16)", width: 720, height: 1280 },
      { label: "Square (1:1)", width: 1440, height: 1440 },
    ],
    supportsImageToVideo: true,
    supportsLastFrame: true,
  },
  {
    id: "bytedance:2@1",
    name: "Seedance 1.0 Pro",
    provider: "ByteDance",
    tagline: "Up to 12-second clips, great for long scenes",
    minDuration: 2,
    maxDuration: 12,
    durationStep: 1,
    // Note: Seedance 1.0 Pro uses 1088 (not 1080) for its 1080p-class height.
    resolutions: [
      { label: "1080p Landscape (16:9)", width: 1920, height: 1088 },
      { label: "1080p Portrait (9:16)", width: 1088, height: 1920 },
      { label: "Square (1:1)", width: 1440, height: 1440 },
    ],
    supportsImageToVideo: true,
    supportsLastFrame: true,
  },
];
