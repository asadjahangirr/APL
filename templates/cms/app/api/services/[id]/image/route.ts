import { database, json } from "../../../../../lib/server";
import {
  serviceIdSchema,
  publishedServiceSchema,
} from "../../../../../lib/services-schema";
import {
  SERVICE_MEDIA_BUCKET,
  serviceImageHeaders,
} from "../../../../../lib/service-images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!serviceIdSchema.safeParse(id).success)
    return json({ error: "Image not found." }, 404);
  try {
    const db = database();
    const publication = await db
      .from("cms_service_publications")
      .select("payload")
      .eq("id", id)
      .maybeSingle();
    if (publication.error)
      return json({ error: "Image storage is unavailable." }, 503);
    const payload = publishedServiceSchema.safeParse(publication.data?.payload);
    if (!payload.success || !payload.data.image)
      return json({ error: "Image not found." }, 404);
    const result = await db.storage
      .from(SERVICE_MEDIA_BUCKET)
      .download(payload.data.image);
    if (result.error || !result.data)
      return json({ error: "Image not found." }, 404);
    // No browser/CDN cache: unpublishing must stop future public reads of this image.
    return new Response(result.data, { headers: serviceImageHeaders });
  } catch {
    return json({ error: "Image storage is unavailable." }, 503);
  }
}
