import "server-only";
import { database } from "./server";
import {
  publishedServiceSchema,
  serviceSlugSchema,
  type ServicePayload,
} from "./services-schema";

export type PublicService = ServicePayload & { id: string };
function publicRecord(row: { id: string; payload: unknown }): PublicService {
  const payload = publishedServiceSchema.parse(row.payload);
  return {
    ...payload,
    id: row.id,
    image: payload.image ? `/api/services/${row.id}/image` : "",
  };
}
export async function listServices(): Promise<PublicService[]> {
  const result = await database()
    .from("cms_service_publications")
    .select("id,payload")
    .order("published_at", { ascending: false })
    .limit(200);
  if (result.error)
    throw new Error(
      "Services are unavailable. Apply the database migrations and import initial content.",
    );
  // Use the same explicit ASCII slug ordering as the editor's sample preview.
  // Database locale and publication timestamps must not change visual ordering.
  return result.data
    .map(publicRecord)
    .sort((left, right) =>
      left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0,
    );
}
export async function getService(slug: string): Promise<PublicService | null> {
  if (!serviceSlugSchema.safeParse(slug).success) return null;
  const result = await database()
    .from("cms_service_publications")
    .select("id,payload")
    .eq("slug", slug)
    .maybeSingle();
  if (result.error)
    throw new Error(
      "Services are unavailable. Check the owner database configuration.",
    );
  return result.data ? publicRecord(result.data) : null;
}
