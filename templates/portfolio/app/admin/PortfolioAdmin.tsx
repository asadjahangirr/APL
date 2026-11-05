"use client";
import { useEffect, useState } from "react";
import type { PortfolioEntry, PortfolioPayload } from "../../lib/portfolio-schema";
import { portfolioPages, portfolioTargetHref } from '../../lib/portfolio-target';
type AdminRequest = (path: string, init?: RequestInit) => Promise<Response>;
const empty = (): PortfolioPayload => ({
  title: "",
  category: "",
  summary: "",
  externalUrl: "",
  image: "",
  imageAlt: "",
});
export default function PortfolioAdmin({
  request,
  onDirtyChange,
}: {
  request: AdminRequest;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [rows, setRows] = useState<PortfolioEntry[]>([]),
    [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<PortfolioPayload>(empty),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [image, setImage] = useState("");
  const entry = rows.find((item) => item.id === selected),
    dirty = Boolean(
      entry && JSON.stringify(entry.draft) !== JSON.stringify(draft),
    );
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  async function load() {
    const response = await request("/api/admin/portfolio");
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Could not load portfolio projects.");
    setRows(result.portfolio);
    return result.portfolio as PortfolioEntry[];
  }
  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
  }, []);
  useEffect(() => {
    let alive = true,
      url = "";
    setImage("");
    if (draft.image)
      void request(
        "/api/admin/portfolio/image?image=" + encodeURIComponent(draft.image),
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("Image could not be loaded.");
          const blob = await response.blob();
          if (alive) {
            url = URL.createObjectURL(blob);
            setImage(url);
          }
        })
        .catch((error) => {
          if (alive) setMessage(error.message);
        });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [draft.image]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function leave() {
    return (
      !dirty ||
      window.confirm("Discard unsaved edits? Your saved draft will be kept.")
    );
  }
  async function mutate(action: "create" | "save" | "publish" | "unpublish") {
    if (action === "create" && !leave()) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await request("/api/admin/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: action === "create" ? crypto.randomUUID() : entry!.id,
          ...(action === "create"
            ? { draft: empty() }
            : { expectedRevision: entry!.revision }),
          ...(action === "save" ? { draft } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Change failed.");
      await load();
      setSelected(result.portfolio.id);
      setDraft(result.portfolio.draft);
      setMessage(
        action === "save"
          ? "Draft saved. The public version is unchanged."
          : action === "publish"
            ? "Published. The website now shows this version."
            : action === "unpublish"
              ? "Unpublished. The draft is still saved."
              : "Private draft created.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Change failed.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    if (!entry) return;
    setBusy(true);
    setMessage("");
    try {
      if (
        file.size > 2 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      )
        throw new Error("Choose a PNG, JPEG or WebP at most 2 MiB.");
      const response = await request(
        "/api/admin/portfolio/image?portfolioId=" + entry.id,
        { method: "POST", headers: { "Content-Type": file.type }, body: file },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setDraft((current) => ({ ...current, image: result.image }));
      setMessage("Image uploaded privately. Save the draft to attach it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Portfolio</h2>
      <p>
        Save drafts privately. Publish only when a project is ready for
        visitors. Each card opens a case-study page here or an external project website.
      </p>
      <div className="cms-admin-grid">
        <aside>
          <button
            disabled={busy || rows.length >= 200}
            onClick={() => void mutate("create")}
          >
            New project
          </button>
          {rows.map((row) => (
            <button
              key={row.id}
              disabled={busy}
              aria-pressed={row.id === selected}
              onClick={() => {
                if (!leave()) return;
                setSelected(row.id);
                setDraft(row.draft);
                setMessage("");
              }}
            >
              {row.draft.title || "Untitled project"}
              <small>
                {!row.published
                  ? "Draft"
                  : JSON.stringify(row.draft) === JSON.stringify(row.published)
                    ? "Published"
                    : "Unpublished changes"}
              </small>
            </button>
          ))}
        </aside>
        <div>
          {entry ? (
            <>
              <div className="cms-admin-fields">
                {(["title", "summary", "category", "imageAlt"] as const).map((key) => {
                  const label = {
                    title: "Title", summary: "Summary", category: "Category",
                    imageAlt: "Image description",
                  }[key];
                  const limit = { title: 120, summary: 320, category: 80, imageAlt: 240 }[key];
                  return (
                    <label key={key}>
                      {label}
                      {key === "summary" ? (
                        <textarea aria-label={label} value={draft[key]} maxLength={limit}
                          rows={3} disabled={busy}
                          onChange={event => setDraft({ ...draft, [key]: event.target.value })} />
                      ) : (
                        <input aria-label={label} value={draft[key]} maxLength={limit}
                          type="text" disabled={busy}
                          onChange={event => setDraft({ ...draft, [key]: event.target.value })} />
                      )}
                    </label>
                  );
                })}
                <label>Card destination
                  <select aria-label="Card destination" value={draft.target ? 'page' : 'external'} disabled={busy}
                    onChange={event => setDraft(current => event.target.value === 'page'
                      ? { ...current, target: { pageId: portfolioPages.find(page => page.path !== '/')?.id ?? portfolioPages[0].id, anchor: '#top' }, externalUrl: '' }
                      : { title: current.title, summary: current.summary, category: current.category, externalUrl: current.externalUrl, image: current.image, imageAlt: current.imageAlt })}>
                    <option value="page">Case-study page on this site</option><option value="external">External project website</option>
                  </select>
                </label>
                {draft.target ? <label>Case-study page
                  <select aria-label="Case-study page" value={draft.target.pageId} disabled={busy}
                    onChange={event => setDraft({ ...draft, target: { pageId: event.target.value, anchor: '#top' } })}>
                    {!portfolioPages.some(page => page.id === draft.target?.pageId) && <option value={draft.target.pageId}>Missing page — choose another destination</option>}
                    {portfolioPages.map(page => <option key={page.id} value={page.id}>{page.name} ({page.path})</option>)}
                  </select>
                </label> : <label>Project URL
                  <input aria-label="Project URL" type="url" value={draft.externalUrl} maxLength={2048}
                    placeholder="https://your-project.example" disabled={busy}
                    onChange={event => setDraft({ ...draft, externalUrl: event.target.value })}/>
                </label>}
                <label>
                  Project image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void upload(file);
                    }}
                  />
                </label>
                {image && (
                  <img
                    className="cms-admin-image"
                    src={image}
                    alt={draft.imageAlt}
                  />
                )}{" "}
                {draft.image && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      setDraft({ ...draft, image: "", imageAlt: "" })
                    }
                  >
                    Remove image from draft
                  </button>
                )}
              </div>
              <p>
                {dirty
                  ? "Unsaved changes. Save the draft before publishing."
                  : entry.published
                    ? "A public version is available."
                    : "This project is private."}
              </p>
              <div className="cms-admin-actions">
                <button
                  className="site-button"
                  disabled={busy || !dirty}
                  onClick={() => void mutate("save")}
                >
                  Save draft
                </button>
                <button
                  disabled={busy || dirty}
                  onClick={() => void mutate("publish")}
                >
                  Publish
                </button>
                {entry.published && (
                  <button
                    disabled={busy || dirty}
                    onClick={() => void mutate("unpublish")}
                  >
                    Unpublish
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (!leave()) return;
                    try {
                      const fresh = (await load()).find(
                        (row) => row.id === entry.id,
                      );
                      if (fresh) setDraft(fresh.draft);
                      setMessage("Reloaded the saved version.");
                    } catch {
                      setMessage("Reload failed.");
                    }
                  }}
                >
                  Reload saved version
                </button>
              </div>
              {entry.published && (
                <a
                  href={entry.published.target
                    ? portfolioTargetHref(entry.published.target)
                    : entry.published.externalUrl}
                  target={entry.published.target ? undefined : '_blank'}
                  rel={entry.published.target ? undefined : 'noopener noreferrer'}
                >
                  {entry.published.target ? 'Open case-study page' : 'Open project website'}
                </a>
              )}
            </>
          ) : (
            <p>Select a project or create your first draft.</p>
          )}
        </div>
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
