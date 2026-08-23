"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { api, type AiStatusResponse } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { Button, cx } from "./ui";
import type { ProviderId } from "@/lib/ai/types";

type Mode = "hybrid" | "ai" | "demo";

export function AiSettings() {
  const { settingsOpen, setSettingsOpen, setAiStatus } = useAppStore();
  const [meta, setMeta] = useState<AiStatusResponse | null>(null);
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<Mode>("hybrid");
  const [enabled, setEnabled] = useState(true);
  const [test, setTest] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);
  const [busy, setBusy] = useState<"test" | "save" | null>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    setTest(null);
    setApiKey("");
    api.getAiConfig().then((r) => {
      setMeta(r);
      setProvider(r.status.provider);
      setModel(r.status.model);
      setMode(r.status.mode);
      setEnabled(r.status.source !== "none");
    });
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const info = meta?.providers[provider];
  const status = meta?.status;
  const payload = { provider, model, apiKey: apiKey || undefined, mode, enabled };

  async function runTest() {
    setBusy("test");
    setTest(null);
    try {
      const r = await api.testAi(payload);
      setTest(r);
    } catch (e) {
      setTest({ ok: false, message: e instanceof Error ? e.message : "Test failed." });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    try {
      const r = await api.saveAiConfig(payload);
      setAiStatus(r.status);
      setSettingsOpen(false);
    } catch (e) {
      setTest({ ok: false, message: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" onClick={() => setSettingsOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-raised p-6 shadow-lift"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-route" />
            <div>
              <h2 className="text-lg font-semibold">AI Brain</h2>
              <p className="text-xs text-muted">Pick any provider. Keys stay on the server and are never shown back.</p>
            </div>
          </div>
          <button onClick={() => setSettingsOpen(false)} className="rounded-full p-1 text-muted hover:bg-line/50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {status && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
            <span className="text-muted">Current:</span>
            <span className="font-medium">{status.providerLabel}</span>
            <span className="text-faint">·</span>
            <span className="text-muted">{status.model || "default model"}</span>
            <span className="text-faint">·</span>
            <span className={cx("font-medium", status.available ? "text-good" : "text-faint")}>
              {status.available ? `Live (${status.mode})` : "Demo / fallback"}
            </span>
            {status.hasKey && <span className="ml-auto font-mono text-xs text-faint">{status.maskedKey}</span>}
          </div>
        )}

        {/* Provider */}
        <label className="mt-4 block text-sm font-medium">Provider</label>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {meta?.providerIds.map((id) => (
            <button
              key={id}
              onClick={() => {
                setProvider(id);
                setModel(meta.providers[id].defaultModel);
                setTest(null);
              }}
              className={cx(
                "rounded-xl border px-3 py-2 text-sm font-medium transition",
                provider === id ? "border-route bg-route-soft text-route" : "border-line bg-surface hover:border-route/40",
              )}
            >
              {meta.providers[id].label}
            </button>
          ))}
        </div>

        {/* Model */}
        <label className="mt-4 block text-sm font-medium">Model</label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          list="model-suggestions"
          placeholder={info?.defaultModel}
          className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-route"
        />
        <datalist id="model-suggestions">
          {info?.models.map((m) => <option key={m} value={m} />)}
        </datalist>

        {/* API key */}
        <label className="mt-4 block text-sm font-medium">API key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={status?.hasKey ? `Saved (${status.maskedKey}) — leave blank to keep` : info?.keyHint}
          className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-route"
        />
        {info?.keyUrl && (
          <a
            href={info.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-route hover:underline"
          >
            Get a key <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {/* Mode */}
        <label className="mt-4 block text-sm font-medium">Mode</label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(["hybrid", "ai", "demo"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cx(
                "rounded-xl border px-2 py-2 text-xs font-medium capitalize transition",
                mode === m ? "border-route bg-route-soft text-route" : "border-line bg-surface hover:border-route/40",
              )}
            >
              {m === "ai" ? "AI" : m}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          {mode === "hybrid" && "Deterministic engine + AI for language tasks (recommended)."}
          {mode === "ai" && "AI for every supported task; path ordering stays deterministic."}
          {mode === "demo" && "No API calls — everything runs on the built-in fallback."}
        </p>

        {test && (
          <div
            className={cx(
              "mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
              test.ok ? "bg-good/10 text-good" : "bg-bad/10 text-bad",
            )}
          >
            {test.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <span>{test.message}</span>
            {test.latencyMs != null && <span className="ml-auto text-xs opacity-70">{test.latencyMs}ms</span>}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Button variant="outline" onClick={runTest} loading={busy === "test"} className="flex-1">
            Test connection
          </Button>
          <Button onClick={save} loading={busy === "save"} className="flex-1">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
