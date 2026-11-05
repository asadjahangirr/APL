import { administrator, json, sameOrigin } from "../../../../lib/server";
import {
  serviceEntrySchema,
  serviceMutationSchema,
} from "../../../../lib/services-schema";
import {
  boundedBytes,
  RequestSizeError,
} from "../../../../lib/service-requests";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = await administrator(request);
    if (!db) return json({ error: "Administrator access required." }, 401);
    const result = await db.rpc("cms_list_services");
    if (result.error)
      return json(
        {
          error: "Content is unavailable. Apply the Services migration first.",
        },
        503,
      );
    const services = serviceEntrySchema.array().max(200).parse(result.data);
    return json({ services });
  } catch {
    return json(
      { error: "Backend setup is incomplete or content is unavailable." },
      503,
    );
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid origin." }, 403);
  try {
    const db = await administrator(request);
    if (!db) return json({ error: "Administrator access required." }, 401);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return json({ error: "Send a JSON content update." }, 415);
    let decoded: unknown;
    try {
      decoded = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          await boundedBytes(request, 64000),
        ),
      );
    } catch (error) {
      if (error instanceof RequestSizeError) throw error;
      return json({ error: "The content update is not valid JSON." }, 400);
    }
    const parsed = serviceMutationSchema.safeParse(decoded);
    if (!parsed.success)
      return json(
        {
          error:
            "Check the title, URL slug, field lengths, and revision before saving.",
        },
        400,
      );
    const input = parsed.data;
    const result = await db.rpc("cms_mutate_service", {
      p_action: input.action,
      p_id: input.id,
      p_expected_revision:
        "expectedRevision" in input ? input.expectedRevision : null,
      p_draft: "draft" in input ? input.draft : null,
    });
    if (result.error) {
      const message = result.error.message;
      if (message.includes("CMS_CONFLICT") || result.error.code === "23505")
        return json(
          {
            error:
              "This service changed in another session, already exists, or its published URL is already in use. Reload before trying again.",
          },
          409,
        );
      if (message.includes("CMS_NOT_FOUND"))
        return json({ error: "Service not found." }, 404);
      if (message.includes("CMS_LIMIT"))
        return json(
          {
            error:
              "This release supports up to 200 services in the deployed CMS.",
          },
          409,
        );
      if (message.includes("CMS_INVALID") || message.includes("CMS_IMAGE"))
        return json(
          {
            error:
              "A title, a valid URL slug, and valid uploaded image are required to publish. Save your draft first.",
          },
          400,
        );
      return json(
        {
          error:
            "Content could not be saved. Check the database setup and try again.",
        },
        503,
      );
    }
    return json(
      { service: serviceEntrySchema.parse(result.data) },
      input.action === "create" ? 201 : 200,
    );
  } catch (error) {
    if (error instanceof RequestSizeError)
      return json({ error: "Content update is too large." }, 413);
    return json(
      { error: "Backend setup is incomplete or content is unavailable." },
      503,
    );
  }
}
