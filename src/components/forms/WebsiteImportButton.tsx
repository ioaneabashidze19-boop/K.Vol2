"use client";

import { Sparkles, Loader2, XCircle, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";

interface WebsiteImportButtonProps {
  onImportSuccess: (profile: any) => void;
  onImportError: (error: string) => void;
  className?: string;
}

export default function WebsiteImportButton({
  onImportSuccess,
  onImportError,
  className = "",
}: WebsiteImportButtonProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStartImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setErrorMsg("Please enter a valid website URL");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setStatusText("Crawling webpage content...");
    onImportError("");

    // Create abort controller for cancel feature
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Simulate status updates for user feedback
      const statusTimeout = setTimeout(() => {
        if (controller.signal.aborted) return;
        setStatusText("Sanitizing parsed page layout...");
      }, 5000);

      const statusTimeout2 = setTimeout(() => {
        if (controller.signal.aborted) return;
        setStatusText("Analyzing details with Gemini 2.0 Flash AI...");
      }, 10000);

      const res = await fetch("/api/auto-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        signal: controller.signal,
      });

      clearTimeout(statusTimeout);
      clearTimeout(statusTimeout2);

      if (!res.ok) {
        throw new Error(`Import failed with status: ${res.status}`);
      }

      const responseData = await res.json();
      if (responseData.success && responseData.profile) {
        setStatusText("Complete! Form populated successfully.");
        onImportSuccess(responseData.profile);
        setTimeout(() => setStatusText(""), 3000);
      } else {
        throw new Error(responseData.error || "Profile parsing failed");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setStatusText("Import cancelled by user");
        setTimeout(() => setStatusText(""), 2000);
      } else {
        const msg = err.message || "Failed resolving AI profile";
        setErrorMsg(msg);
        onImportError(msg);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className={`bg-slate-950/60 border border-slate-850 rounded-2xl p-4 space-y-3 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> AI-Powered Auto Import
        </span>
        {loading && (
          <span className="text-[10px] text-cyan-400 animate-pulse font-medium">
            {statusText}
          </span>
        )}
      </div>

      <p className="text-[10px] text-text-muted">
        Input your corporate website URL and our crawler will automatically extract your agency profile, service lists, target niches, and team bios.
      </p>

      <form onSubmit={handleStartImport} className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          required
          disabled={loading}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youragency.com"
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-text-primary focus:outline-none focus:border-cyan-500 disabled:opacity-50"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-850 border border-slate-850 hover:border-cyan-500/40 text-xs font-bold px-4 py-2.5 rounded-xl text-cyan-400 flex items-center justify-center gap-1.5 transition whitespace-nowrap disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning
              </>
            ) : (
              "Auto-fill from Website"
            )}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancel}
              className="p-2.5 bg-slate-900 hover:bg-red-950/30 border border-slate-800 hover:border-red-900/30 rounded-xl text-text-muted hover:text-red-400 transition"
              title="Cancel crawl"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {errorMsg && (
        <div className="flex items-start gap-2 bg-red-950/10 border border-red-500/20 p-2.5 rounded-lg">
          <AlertCircle className="h-4 w-4 text-brand-destructive shrink-0 mt-0.5" />
          <span className="text-[10px] text-brand-destructive leading-normal">
            {errorMsg}. You can proceed by completing the form stages manually.
          </span>
        </div>
      )}

      {statusText && !loading && !errorMsg && (
        <span className="text-[10px] text-emerald-400 font-semibold block">
          {statusText}
        </span>
      )}
    </div>
  );
}
