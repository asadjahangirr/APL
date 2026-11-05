"use client";
import { useEffect, useState } from "react";
import type { ArticleEntry, ArticlePayload } from "../../lib/articles-schema";
type AdminRequest = (path: string, init?: RequestInit) => Promise<Response>;
const empty = (): ArticlePayload => ({
  title: "",
  slug: "",
  summary: "",
  body: "",
  image: "",
  imageAlt: "",
});
export default function ArticlesAdmin({
  request,
  onDirtyChange,
}: {
  request: AdminRequest;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [rows, setRows] = useState<ArticleEntry[]>([]),
    [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<ArticlePayload>(empty),
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
    const response = await request("/api/admin/articles");
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Could not load articles.");
    setRows(result.articles);
    return result.articles as ArticleEntry[];
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
        "/api/admin/articles/image?image=" + encodeURIComponent(draft.image),
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
      const response = await request("/api/admin/articles", {
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
      setSelected(result.article.id);
      setDraft(result.article.draft);
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
        "/api/admin/articles/image?articleId=" + entry.id,
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
      <h2>Articles</h2>
      <p>
        Save drafts privately. Publish only when an article is ready for
        visitors.
      </p>
      <div className="cms-admin-grid">
        <aside>
          <button
            disabled={busy || rows.length >= 200}
            onClick={() => void mutate("create")}
          >
            New article
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
              {row.draft.title || "Untitled article"}
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
                {(
                  ["title", "slug", "summary", "body", "imageAlt"] as const
                ).map((key) => (
                  <label key={key}>
                    {
                      {
                        title: "Title",
                        slug: "URL slug",
                        summary: "Summary",
                        body: "Body",
                        imageAlt: "Image description",
                      }[key]
                    }
                    {key === "summary" || key === "body" ? (
                      <textarea aria-label={key === "body" ? "Body" : "Summary"}
                        value={draft[key]}
                        maxLength={key === "body" ? 12000 : 320}
                        rows={key === "body" ? 8 : 3}
                        disabled={busy}
                        onChange={(event) =>
                          setDraft({ ...draft, [key]: event.target.value })
                        }
                      />
                    ) : (
                      <input
                        value={draft[key]}
                        maxLength={
                          key === "title" ? 120 : key === "slug" ? 80 : 240
                        }
                        disabled={busy}
                        onChange={(event) =>
                          setDraft({ ...draft, [key]: event.target.value })
                        }
                      />
                    )}
                  </label>
                ))}
                <label>
                  Article image
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
                    : "This article is private."}
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
                  href={"/articles/" + entry.published.slug}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open public article
                </a>
              )}
            </>
          ) : (
            <p>Select an article or create your first draft.</p>
          )}
        </div>
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
