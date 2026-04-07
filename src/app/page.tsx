"use client";

import { useState, useMemo, useRef } from "react";
import { VIDEO_MODELS, VideoModel } from "@/lib/models";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showNegative, setShowNegative] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(VIDEO_MODELS[0].id);
  const [resolutionIndex, setResolutionIndex] = useState(0);
  const [duration, setDuration] = useState(VIDEO_MODELS[0].minDuration);
  const [modelSearch, setModelSearch] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const [seedImage, setSeedImage] = useState<string | null>(null);
  const [seedImageName, setSeedImageName] = useState<string | null>(null);
  const [lastFrameImage, setLastFrameImage] = useState<string | null>(null);
  const [lastFrameImageName, setLastFrameImageName] = useState<string | null>(null);
  const seedInputRef = useRef<HTMLInputElement>(null);
  const lastFrameInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedModel = VIDEO_MODELS.find(
    (m) => m.id === selectedModelId
  ) as VideoModel;

  const filteredModels = useMemo(() => {
    if (!modelSearch) return VIDEO_MODELS;
    const q = modelSearch.toLowerCase();
    return VIDEO_MODELS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)
    );
  }, [modelSearch]);

  function selectModel(model: VideoModel) {
    setSelectedModelId(model.id);
    setResolutionIndex(0);
    setDuration(model.minDuration);
    setModelDropdownOpen(false);
    setModelSearch("");
    // Clear last frame image if the new model doesn't support it
    if (!model.supportsLastFrame) {
      setLastFrameImage(null);
      setLastFrameImageName(null);
    }
  }

  function handleImageUpload(
    file: File,
    setter: (val: string | null) => void,
    nameSetter: (val: string | null) => void
  ) {
    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
      nameSetter(file.name);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(
    e: React.DragEvent,
    setter: (val: string | null) => void,
    nameSetter: (val: string | null) => void
  ) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file, setter, nameSetter);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setVideoURL(null);

    const res = selectedModel.resolutions[resolutionIndex];

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          model: selectedModelId,
          width: res.width,
          height: res.height,
          duration,
          seedImage: seedImage || undefined,
          lastFrameImage: lastFrameImage || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setVideoURL(data.videoURL);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            AI+ Video Generator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate videos from text prompts and images
          </p>
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-sm font-medium mb-2">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the video you want to generate..."
            rows={4}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none placeholder:text-gray-400"
          />
        </div>

        {/* Negative Prompt (optional) */}
        <div>
          <button
            type="button"
            onClick={() => setShowNegative(!showNegative)}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            {showNegative ? "- Hide" : "+ Add"} negative prompt
          </button>
          {showNegative && (
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="What to avoid in the video..."
              rows={2}
              className="w-full mt-2 rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none placeholder:text-gray-400"
            />
          )}
        </div>

        {/* Image Inputs */}
        {selectedModel.supportsImageToVideo && (
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              Reference Images{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>

            <div className={`grid gap-4 ${selectedModel.supportsLastFrame ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {/* First Frame / Seed Image */}
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  {selectedModel.supportsLastFrame ? "First frame" : "Seed image"}
                </p>
                <input
                  ref={seedInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, setSeedImage, setSeedImageName);
                  }}
                />
                {seedImage ? (
                  <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                    <img
                      src={seedImage}
                      alt="Seed image"
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center group">
                      <button
                        type="button"
                        onClick={() => {
                          setSeedImage(null);
                          setSeedImageName(null);
                          if (seedInputRef.current) seedInputRef.current.value = "";
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-white rounded-md text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="px-3 py-2 text-xs text-gray-500 truncate">
                      {seedImageName}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => seedInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, setSeedImage, setSeedImageName)}
                    className="w-full h-40 rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">Click or drop image</span>
                  </button>
                )}
              </div>

              {/* Last Frame (only for models that support it) */}
              {selectedModel.supportsLastFrame && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Last frame</p>
                  <input
                    ref={lastFrameInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, setLastFrameImage, setLastFrameImageName);
                    }}
                  />
                  {lastFrameImage ? (
                    <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                      <img
                        src={lastFrameImage}
                        alt="Last frame image"
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center group">
                        <button
                          type="button"
                          onClick={() => {
                            setLastFrameImage(null);
                            setLastFrameImageName(null);
                            if (lastFrameInputRef.current) lastFrameInputRef.current.value = "";
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-white rounded-md text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="px-3 py-2 text-xs text-gray-500 truncate">
                        {lastFrameImageName}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => lastFrameInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, setLastFrameImage, setLastFrameImageName)}
                      className="w-full h-40 rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs">Click or drop image</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Model Selector */}
          <div className="relative">
            <label className="block text-sm font-medium mb-2">Model</label>
            <button
              type="button"
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="w-full text-left rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
            >
              <span className="block truncate">{selectedModel.name}</span>
              <span className="block text-xs text-gray-400 truncate">
                {selectedModel.provider}
              </span>
            </button>

            {modelDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => {
                    setModelDropdownOpen(false);
                    setModelSearch("");
                  }}
                />
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="Search models..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredModels.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => selectModel(model)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                          model.id === selectedModelId ? "bg-gray-50" : ""
                        }`}
                      >
                        <span className="block font-medium">{model.name}</span>
                        <span className="block text-xs text-gray-400">
                          {model.provider}
                        </span>
                      </button>
                    ))}
                    {filteredModels.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-400">
                        No models found
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Resolution */}
          <div>
            <label className="block text-sm font-medium mb-2">Resolution</label>
            <select
              value={resolutionIndex}
              onChange={(e) => setResolutionIndex(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
            >
              {selectedModel.resolutions.map((res, i) => (
                <option key={i} value={i}>
                  {res.label}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Duration ({duration}s)
            </label>
            <input
              type="range"
              min={selectedModel.minDuration}
              max={selectedModel.maxDuration}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full mt-2 accent-gray-900"
              disabled={selectedModel.minDuration === selectedModel.maxDuration}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{selectedModel.minDuration}s</span>
              <span>{selectedModel.maxDuration}s</span>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full py-3 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating...
            </span>
          ) : (
            seedImage ? "Generate Video from Image" : "Generate Video"
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Video Output */}
        {videoURL && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              <video
                src={videoURL}
                controls
                className="w-full"
                autoPlay
                loop
              />
            </div>
            <a
              href={videoURL}
              download="generated-video.mp4"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download Video
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
