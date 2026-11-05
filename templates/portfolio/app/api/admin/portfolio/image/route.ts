import { randomUUID } from "node:crypto";
import { administrator, json, sameOrigin } from "../../../../../lib/server";
import {
  portfolioIdSchema,
  portfolioImageSchema,
} from "../../../../../lib/portfolio-schema";
import {
  boundedBytes,
  RequestSizeError,
} from "../../../../../lib/cms-requests";
import {
  MAX_CMS_IMAGE_BYTES,
  normalizeCmsImage,
  PORTFOLIO_MEDIA_BUCKET,
  portfolioImageHeaders,
} from "../../../../../lib/portfolio-images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = await administrator(request);
    if (!db) return json({ error: "Administrator access required." }, 401);
    const image = new URL(request.url).searchParams.get("image");
    if (!image || !portfolioImageSchema.safeParse(image).success)
      return json({ error: "Invalid image reference." }, 400);
    const result = await db.storage.from(PORTFOLIO_MEDIA_BUCKET).download(image);
    if (result.error || !result.data)
      return json({ error: "Image not found." }, 404);
    return new Response(result.data, { headers: portfolioImageHeaders });
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
    const portfolioId = new URL(request.url).searchParams.get("portfolioId");
    if (!portfolioIdSchema.safeParse(portfolioId).success)
      return json({ error: "A valid project ID is required." }, 400);
    const project = await db
      .from("cms_portfolio")
      .select("id")
      .eq("id", portfolioId)
      .maybeSingle();
    if (project.error)
      return json(
        {
          error: "Content is unavailable. Apply the Portfolio migration first.",
        },
        503,
      );
    if (!project.data)
      return json(
        { error: "Create and save this project before uploading an image." },
        404,
      );
    const bytes = await boundedBytes(request, MAX_CMS_IMAGE_BYTES);
    let output: Buffer;
    try {
      output = await normalizeCmsImage(
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
    const path = `${project.data.id}/${randomUUID()}.webp`;
    const upload = await db.storage
      .from(PORTFOLIO_MEDIA_BUCKET)
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
