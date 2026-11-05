import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Render } from "@puckeditor/core";
import { createConfig, toEditor } from "./config";
import { hasArticles, hasServices, type Project } from "../project/schema";
import { publicServices, serviceCollectionDefaults } from "../project/services";
import { headerHref, navigationLinks } from "../project/pages";
import Header from "../site/Header";
import Footer from "../site/Footer";
import ServiceCollection from "../site/ServiceCollection";
import ServiceDetail from "../site/ServiceDetail";
import ArticleCollection from "../site/ArticleCollection";
import ArticleDetail from "../site/ArticleDetail";
import { publicArticles, articleCollectionDefaults } from "../project/articles";
import siteCss from "../site/site.css?inline";
import { themeStyle } from '../project/theme';
export default function Preview({
  project,
  initialPageId,
  close,
  closeLabel = 'Back to editor',
}: {
  project: Project;
  initialPageId: string;
  close: () => void;
  closeLabel?: string;
}) {
  const [width, setWidth] = useState(1280);
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [location, setLocation] = useState({
    path: project.pages.find((page) => page.id === initialPageId)!.path,
    anchor: "#top",
    visit: 0,
  });
  const page = project.pages.find((page) => page.path === location.path);
  const items = publicServices(project),
    service = items.find((item) => "/services/" + item.slug === location.path);
  const collection = project.pages
    .flatMap((page) => page.nodes)
    .find((node) => node.type === "ServiceCollection");
  const articleItems = publicArticles(project);
  const article = articleItems.find((item) => "/articles/" + item.slug === location.path);
  const articleCollection = project.pages.flatMap((entry) => entry.nodes).find((node) => node.type === 'ArticleCollection');
  const isArticleRoute = hasArticles(project) && (location.path === '/articles' || Boolean(article));
  useEffect(() => {
    const doc = frame?.contentDocument;
    if (!ready || !doc) return;
    doc.title = page?.title || service?.title || article?.title || (isArticleRoute ? "Articles" : "Services");
    doc.querySelectorAll<HTMLDetailsElement>("details").forEach((details) => {
      details.open = false;
    });
    doc.getElementById(location.anchor.slice(1))?.scrollIntoView();
  }, [frame, ready, page, service, article, isArticleRoute, location]);
  return (
    <section className="preview-screen">
      <div className="preview-toolbar">
        <button onClick={close}>← {closeLabel}</button>
        <strong>Preview</strong>
        <span>Sample mode · backend actions are simulated</span>
        <label>
          Page
          <select
            aria-label="Preview page"
            value={page?.id || (isArticleRoute ? "articles-cms" : "services-cms")}
            onChange={(event) =>
              setLocation({
                path:
                  event.target.value === "services-cms" || event.target.value === "articles-cms"
                    ? event.target.value === "services-cms" ? "/services" : "/articles"
                    : project.pages.find(
                        (page) => page.id === event.target.value,
                      )!.path,
                anchor: "#top",
                visit: location.visit + 1,
              })
            }
          >
            {project.pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
            {hasServices(project) && (
              <option value="services-cms">Services collection</option>
            )}
            {hasArticles(project) && <option value="articles-cms">Articles collection</option>}
          </select>
        </label>
        <code>{location.path}</code>
        <label>
          Width
          <select
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          >
            <option value={390}>Mobile · 390</option>
            <option value={768}>Tablet · 768</option>
            <option value={1280}>Desktop · 1280</option>
          </select>
        </label>
      </div>
      <div className="preview-stage">
        <iframe
          ref={setFrame}
          title="Website preview"
          style={{ width, maxWidth: "100%", height: "calc(100dvh - 150px)" }}
          srcDoc="<!doctype html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'></head><body style='margin:0'></body></html>"
          onLoad={() => setReady(true)}
        />
        {ready &&
          frame?.contentDocument?.body &&
          createPortal(
            <div
              onClickCapture={(event) => {
                const link = (event.target as HTMLElement).closest?.("a[href]");
                if (!link) return;
                if (link.getAttribute("target") === "_blank") return;
                event.preventDefault();
                const url = new URL(
                  link.getAttribute("href")!,
                  "https://preview.invalid" + location.path,
                );
                if (
                  url.origin === "https://preview.invalid" &&
                  (project.pages.some((page) => page.path === url.pathname) ||
                    (hasServices(project) &&
                      (url.pathname === "/services" ||
                        items.some(
                          (item) => url.pathname === "/services/" + item.slug,
                        ))) ||
                    (hasArticles(project) && (url.pathname === '/articles' || articleItems.some(item => url.pathname === '/articles/' + item.slug))))
                )
                  setLocation({
                    path: url.pathname,
                    anchor: url.hash || "#top",
                    visit: location.visit + 1,
                  });
              }}
            >
              {page ? (
                <Render
                  key={page.id}
                  config={createConfig(project, page.id, false)}
                  data={toEditor(project, page.id)}
                />
              ) : (
                <>
                  <style>{siteCss}</style>
                  <main
                    id="top"
                    className="site"
                    data-font={project.theme.font}
                    style={
                      themeStyle(project.theme)
                    }
                  >
                    {project.shared.header.enabled && (
                      <Header
                        {...project.shared.header.props}
                        href={headerHref(project) || "/"}
                        links={navigationLinks(project)}
                        activePageId={isArticleRoute ? 'articles-cms' : 'services-cms'}
                      />
                    )}
                    {isArticleRoute ? article ? <ArticleDetail article={article}/> : <ArticleCollection {...(articleCollection?.props || articleCollectionDefaults)} items={articleItems} pageTitle/> : service ? (
                      <ServiceDetail service={service} />
                    ) : (
                      <ServiceCollection
                        {...(collection?.props || serviceCollectionDefaults)}
                        items={items}
                        pageTitle
                      />
                    )}{" "}
                    {project.shared.footer.enabled && (
                      <Footer {...project.shared.footer.props} />
                    )}
                  </main>
                </>
              )}
            </div>,
            frame.contentDocument.body,
          )}
      </div>
    </section>
  );
}
