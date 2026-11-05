import { useState } from "react";
import Dialog from "./Dialog";
import { ImageField } from "./config";
import { hasArticles, type Project } from "../project/schema";
import {
  addArticleCollection,
  createArticle,
  mutateArticle,
} from "../project/articles";
import type { ArticlePayload } from "../project/article-schema";
import ArticleDetail from "../site/ArticleDetail";
import siteCss from "../site/site.css?inline";
import { themeStyle } from '../project/theme';
export default function ArticlesManager({
  project,
  pageId,
  save,
  close,
}: {
  project: Project;
  pageId: string;
  save: (project: Project) => void;
  close: () => void;
}) {
  const [selected, setSelected] = useState(
    project.content.articles[0]?.id || "",
  );
  const entry = project.content.articles.find((item) => item.id === selected);
  const [draft, setDraft] = useState<ArticlePayload | null>(
    entry?.draft || null,
  );
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const dirty = Boolean(
    entry && draft && JSON.stringify(entry.draft) !== JSON.stringify(draft),
  );
  function change(next: Project) {
    save(next);
    setError("");
  }
  function run(action: () => void) {
    try {
      action();
    } catch (e) {
      setError(
        e instanceof Error
          ? "issues" in e
            ? "Check the title, URL slug, content limits and published URL uniqueness."
            : e.message
          : "Could not save.",
      );
    }
  }
  function leave() {
    return (
      !dirty ||
      window.confirm(
        "Discard unsaved article edits? Your last saved draft will be kept.",
      )
    );
  }
  function field(key: keyof ArticlePayload, value: string) {
    setDraft((current) => (current ? { ...current, [key]: value } : null));
  }
  return (
    <Dialog
      title="Articles content"
      wide
      close={() => {
        if (leave()) close();
      }}
    >
      <p>
        Save drafts privately, then publish the version visitors should see.
        These are local sample records for your next export. Changes to a
        deployed website belong in that website's own admin.
      </p>
      {!hasArticles(project) && (
        <p className="cms-notice">
          Add a collection section to include the CMS backend and article pages
          in your export.{" "}
          <button
            onClick={() =>
              run(() => change(addArticleCollection(project, pageId)))
            }
          >
            Add articles collection to this page
          </button>
        </p>
      )}
      <div className="cms-workspace">
        <aside className="cms-records">
          <button
            className="primary"
            disabled={project.content.articles.length >= 50}
            onClick={() =>
              run(() => {
                if (!leave()) return;
                const next = createArticle(project);
                change(next.project);
                setSelected(next.id);
                setDraft(next.project.content.articles.at(-1)!.draft);
                setPreview(false);
              })
            }
          >
            New article
          </button>
          <p>{project.content.articles.length} / 50 local records</p>
          {project.content.articles.map((item) => (
            <button
              key={item.id}
              aria-pressed={selected === item.id}
              onClick={() => {
                if (!leave()) return;
                setSelected(item.id);
                setDraft(item.draft);
                setError("");
                setPreview(false);
              }}
            >
              <strong>{item.draft.title || "Untitled article"}</strong>
              <small>
                {!item.published
                  ? "Draft"
                  : JSON.stringify(item.draft) ===
                      JSON.stringify(item.published)
                    ? "Published for export"
                    : "Unpublished changes"}
              </small>
            </button>
          ))}
        </aside>
        <div>
          {!entry || !draft ? (
            <div className="cms-empty">
              <h3>Your article library starts here.</h3>
              <p>
                Create an article, share a useful story, and preview its
                detail page before publishing.
              </p>
            </div>
          ) : (
            <>
              <div className="cms-state">
                <span>
                  {entry.published
                    ? "Published snapshot available"
                    : "Private draft"}
                  {dirty ? " · Unsaved edits" : ""}
                </span>
                <button onClick={() => setPreview((value) => !value)}>
                  {preview ? "Edit fields" : "Preview draft"}
                </button>
              </div>
              {preview ? (
                <div className="cms-draft-preview">
                  <p>Draft preview only · this version is not public.</p>
                  <style>{siteCss}</style>
                  <div className="site" data-font={project.theme.font} style={themeStyle(project.theme)}>
                    <ArticleDetail article={{ id: entry.id, ...draft }} />
                  </div>
                </div>
              ) : (
                <div className="cms-fields">
                  <label>
                    Title
                    <input
                      value={draft.title}
                      maxLength={120}
                      onChange={(e) => field("title", e.target.value)}
                    />
                  </label>
                  <label>
                    URL slug
                    <input
                      value={draft.slug}
                      maxLength={80}
                      placeholder="brand-strategy"
                      onChange={(e) => field("slug", e.target.value)}
                    />
                    <small>
                      /articles/{draft.slug || "your-article"} · lowercase words
                      separated by hyphens
                    </small>
                  </label>
                  <label>
                    Summary
                    <textarea
                      aria-label="Summary"
                      value={draft.summary}
                      maxLength={320}
                      rows={3}
                      onChange={(e) => field("summary", e.target.value)}
                    />
                  </label>
                  <label>
                    Body
                    <textarea
                      aria-label="Body"
                      value={draft.body}
                      maxLength={12000}
                      rows={8}
                      onChange={(e) => field("body", e.target.value)}
                    />
                  </label>
                  <ImageField
                    value={draft.image}
                    onChange={(value) => field("image", value)}
                  />
                  {draft.image && (
                    <img
                      className="cms-image"
                      src={draft.image}
                      alt={draft.imageAlt}
                    />
                  )}
                  <label>
                    Image description
                    <input
                      value={draft.imageAlt}
                      maxLength={240}
                      onChange={(e) => field("imageAlt", e.target.value)}
                    />
                  </label>
                </div>
              )}
              <div className="cms-actions">
                <button
                  className="primary"
                  disabled={!dirty}
                  onClick={() =>
                    run(() =>
                      change(
                        mutateArticle(
                          project,
                          entry.id,
                          "save",
                          entry.revision,
                          draft,
                        ),
                      ),
                    )
                  }
                >
                  Save draft
                </button>
                <button
                  disabled={dirty}
                  onClick={() =>
                    run(() =>
                      change(
                        mutateArticle(
                          project,
                          entry.id,
                          "publish",
                          entry.revision,
                        ),
                      ),
                    )
                  }
                >
                  Publish for export
                </button>
                {entry.published && (
                  <button
                    disabled={dirty}
                    onClick={() =>
                      run(() =>
                        change(
                          mutateArticle(
                            project,
                            entry.id,
                            "unpublish",
                            entry.revision,
                          ),
                        ),
                      )
                    }
                  >
                    Unpublish
                  </button>
                )}
              </div>
              <p>
                {dirty
                  ? "Save your draft before publishing."
                  : "Publishing copies the saved draft. Later draft edits keep that public snapshot unchanged."}
              </p>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      </div>
    </Dialog>
  );
}
