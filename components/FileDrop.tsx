"use client";

import { useRef, useState } from "react";

/** Reads a plan file locally and hands its text to the parent. Never uploads. */
export default function FileDrop({ onLoad }: { onLoad: (text: string, label: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setReadError(null);
    try {
      const text = await file.text();
      onLoad(text, file.name);
    } catch (err) {
      // A read failure is not a ParseError; surface it here so it never fails silently.
      setReadError(err instanceof Error ? err.message : "Could not read the file.");
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFile(e.dataTransfer.files[0]);
      }}
      className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
        dragging ? "border-brand bg-brand/5" : "border-slate-300 bg-white"
      }`}
    >
      <p className="text-sm text-slate-600">
        Drop a <span className="font-mono">terraform show -json</span> file here, or{" "}
        <button
          type="button"
          className="font-medium text-brand-dark underline"
          onClick={() => inputRef.current?.click()}
        >
          choose a file
        </button>
        .
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Parsed entirely in your browser. The plan never leaves your machine.
      </p>
      {readError && (
        <p className="mt-2 text-xs text-danger">Could not read that file: {readError}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
