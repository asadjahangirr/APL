import { projectSchema, type Project } from "./schema";
import {
  emptyArticle,
  articlePayloadSchema,
  publishedArticleSchema,
  type ArticlePayload,
  type PublicArticle,
} from "./article-schema";
export const articleCollectionDefaults = {
  title: "Field notes",
  description: "Ideas, process and perspective from our studio.",
  mobile: 1,
  tablet: 2,
  desktop: 2,
  gap: 24,
  design: 'classic' as const,
  motion: 'none' as const,
};
export function publicArticles(project: Project): PublicArticle[] {
  return project.content.articles
    .flatMap((entry) =>
      entry.published ? [{ id: entry.id, ...entry.published }] : [],
    )
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}
export function addArticleCollection(
  project: Project,
  pageId: string,
): Project {
  return projectSchema.parse({
    ...project,
    updatedAt: new Date().toISOString(),
    pages: project.pages.map((page) =>
      page.id !== pageId ||
      page.nodes.some((node) => node.type === "ArticleCollection")
        ? page
        : {
            ...page,
            nodes: [
              ...page.nodes,
              {
                id: crypto.randomUUID(),
                type: "ArticleCollection",
                props: articleCollectionDefaults,
              },
            ],
          },
    ),
  });
}
export function createArticle(project: Project): {
  project: Project;
  id: string;
} {
  const id = crypto.randomUUID();
  return {
    id,
    project: projectSchema.parse({
      ...project,
      updatedAt: new Date().toISOString(),
      content: { ...project.content,
        articles: [
          ...project.content.articles,
          {
            id,
            draft: emptyArticle(),
            published: null,
            revision: 1,
            publishedRevision: null,
          },
        ],
      },
    }),
  };
}
export function mutateArticle(
  project: Project,
  id: string,
  action: "save" | "publish" | "unpublish",
  expectedRevision: number,
  draft?: ArticlePayload,
): Project {
  const entry = project.content.articles.find((item) => item.id === id);
  if (!entry) throw new Error("Article not found.");
  if (entry.revision !== expectedRevision)
    throw new Error("This article changed. Reopen it before saving.");
  const revision = entry.revision + 1;
  const updated =
    action === "save"
      ? { ...entry, draft: articlePayloadSchema.parse(draft), revision }
      : action === "publish"
        ? {
            ...entry,
            published: structuredClone(
              publishedArticleSchema.parse(entry.draft),
            ),
            revision,
            publishedRevision: revision,
          }
        : { ...entry, published: null, revision, publishedRevision: null };
  return projectSchema.parse({
    ...project,
    updatedAt: new Date().toISOString(),
    content: { ...project.content,
      articles: project.content.articles.map((item) =>
        item.id === id ? updated : item,
      ),
    },
  });
}
