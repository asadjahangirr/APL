import { randomUUID } from "node:crypto";
import { administrator, json, sameOrigin } from "../../../../../lib/server";
import {
  serviceIdSchema,
  serviceImageSchema,
} from "../../../../../lib/services-schema";
import {
  boundedBytes,
  RequestSizeError,
} from "../../../../../lib/service-requests";
import {
  MAX_SERVICE_IMAGE_BYTES,
  normalizeServiceImage,
  SERVICE_MEDIA_BUCKET,
  serviceImageHeaders,
} from "../../../../../lib/service-images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = await administrator(request);
    if (!db) return json({ error: "Administrator access required." }, 401);
    const image = new URL(request.url).searchParams.get("image");
    if (!image || !serviceImageSchema.safeParse(image).success)
      return json({ error: "Invalid image reference." }, 400);
    const result = await db.storage.from(SERVICE_MEDIA_BUCKET).download(image);
    if (result.error || !result.data)
      return json({ error: "Image not found." }, 404);
    return new Response(result.data, { headers: serviceImageHeaders });
  } catch {
    return json(
      {
        error: "Image storage is unavailable. Check the owner Supabase setup.",
      },
      503,
    );
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid origin." }, 403);
  try {
    const db = await administrator(request);
    if (!db) return json({ error: "Administrator access required." }, 401);
    const serviceId = new URL(request.url).searchParams.get("serviceId");
    if (!serviceIdSchema.safeParse(serviceId).success)
      return json({ error: "A valid service ID is required." }, 400);
    const service = await db
      .from("cms_services")
      .select("id")
      .eq("id", serviceId)
      .maybeSingle();
    if (service.error)
      return json(
        {
          error: "Content is unavailable. Apply the Services migration first.",
        },
        503,
      );
    if (!service.data)
      return json(
        { error: "Create and save this service before uploading an image." },
        404,
      );
    const bytes = await boundedBytes(request, MAX_SERVICE_IMAGE_BYTES);
    let output: Buffer;
    try {
      output = await normalizeServiceImage(
        bytes,
        request.headers
          .get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase() ?? "",
      );
    } catch {
      return json(
        {
          error:
            "Choose a valid, non-animated PNG, JPEG, or WebP image under 2 MB and 24 million pixels.",
        },
        400,
      );
    }
    const path = `${service.data.id}/${randomUUID()}.webp`;
    const upload = await db.storage
      .from(SERVICE_MEDIA_BUCKET)
      .upload(path, output, {
        contentType: "image/webp",
        upsert: false,
        cacheControl: "0",
      });
    if (upload.error)
      return json(
        {
          error:
            "Image could not be stored. Check the private bucket configuration and storage quota.",
        },
        503,
      );
    return json({ image: path }, 201);
  } catch (error) {
    if (error instanceof RequestSizeError)
      return json({ error: "Image must be at most 2 MB." }, 413);
    return json(
      {
        error: "Image storage is unavailable. Check the owner Supabase setup.",
      },
      503,
    );
  }
}
