import "server-only";
import { database } from "./server";
import {
  publishedArticleSchema,
  articleSlugSchema,
  type ArticlePayload,
} from "./articles-schema";

export type PublicArticle = ArticlePayload & { id: string };
function publicRecord(row: { id: string; payload: unknown }): PublicArticle {
  const payload = publishedArticleSchema.parse(row.payload);
  return {
    ...payload,
    id: row.id,
    image: payload.image ? `/api/articles/${row.id}/image` : "",
  };
}
export async function listArticles(): Promise<PublicArticle[]> {
  const result = await database()
    .from("cms_article_publications")
    .select("id,payload")
    .order("published_at", { ascending: false })
    .limit(200);
  if (result.error)
    throw new Error(
      "Articles are unavailable. Apply the database migrations and import initial content.",
    );
  // Use the same explicit ASCII slug ordering as the editor's sample preview.
  // Database locale and publication timestamps must not change visual ordering.
  return result.data
    .map(publicRecord)
    .sort((left, right) =>
      left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0,
    );
}
export async function getArticle(slug: string): Promise<PublicArticle | null> {
  if (!articleSlugSchema.safeParse(slug).success) return null;
  const result = await database()
    .from("cms_article_publications")
    .select("id,payload")
    .eq("slug", slug)
    .maybeSingle();
  if (result.error)
    throw new Error(
      "Articles are unavailable. Check the owner database configuration.",
    );
  return result.data ? publicRecord(result.data) : null;
}
