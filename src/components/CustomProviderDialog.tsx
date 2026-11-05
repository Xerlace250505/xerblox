import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAddCustomProvider } from "@/hooks/mutations/useAddCustomProvider";
import { notify } from "@/lib/notifications";

interface CustomProviderDialogProps {
  onClose: () => void;
  onAdded: () => void;
}

function CustomProviderDialog({ onClose, onAdded }: CustomProviderDialogProps) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [close]);

  const addMutation = useAddCustomProvider();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim() || !apiKey.trim() || !modelId.trim()) return;
    setSaving(true);
    try {
      await addMutation.mutateAsync({
        name: name.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/, ""),
        apiKey: apiKey.trim(),
        modelId: modelId.trim(),
      });
      notify.success(`Custom provider "${name.trim()}" added`);
      onAdded();
      close();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to add custom provider");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-provider-title"
        className="mx-4 w-full max-w-sm rounded-xl border bg-card p-5 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2">
          <h5 id="custom-provider-title" className="truncate text-sm font-medium">
            Add Custom Provider
          </h5>
          <button
            onClick={close}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Connect any OpenAI-compatible API endpoint. The base URL should point to the
          <code className="mx-1 rounded bg-muted px-1 font-mono text-[10px]">/v1</code>
          root (e.g. <code className="rounded bg-muted px-1 font-mono text-[10px]">https://api.example.com/v1</code>).
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="cp-name" className="block text-xs text-muted-foreground">
              Provider Name
            </label>
            <input
              id="cp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom API"
              required
              className="h-8 w-full rounded-md border bg-transparent px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cp-url" className="block text-xs text-muted-foreground">
              Base URL
            </label>
            <input
              id="cp-url"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              required
              className="h-8 w-full rounded-md border bg-transparent px-2 font-mono text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cp-key" className="block text-xs text-muted-foreground">
              API Key
            </label>
            <input
              id="cp-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              required
              className="h-8 w-full rounded-md border bg-transparent px-2 font-mono text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cp-model" className="block text-xs text-muted-foreground">
              Default Model ID
            </label>
            <input
              id="cp-model"
              type="text"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="gpt-4o"
              required
              className="h-8 w-full rounded-md border bg-transparent px-2 font-mono text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !name.trim() || !baseUrl.trim() || !apiKey.trim() || !modelId.trim()}
            className="h-8 w-full rounded bg-foreground text-xs font-medium text-background transition-opacity disabled:opacity-40"
          >
            {saving ? "Adding..." : "Add Provider"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CustomProviderDialog;