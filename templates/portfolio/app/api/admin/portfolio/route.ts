import { administrator, json, sameOrigin } from "../../../../lib/server";
import {
  portfolioEntrySchema,
  portfolioMutationSchema,
} from "../../../../lib/portfolio-schema";
import {
  boundedBytes,
  RequestSizeError,
} from "../../../../lib/cms-requests";
import { portfolioTargetHref } from '../../../../lib/portfolio-target';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = await administrator(request);
    if (!db) return json({ error: "Administrator access required." }, 401);
    const result = await db.rpc("cms_list_portfolio");
    if (result.error)
      return json(
        {
          error: "Content is unavailable. Apply the Portfolio migration first.",
        },
        503,
      );
    const portfolio = portfolioEntrySchema.array().max(200).parse(result.data);
    return json({ portfolio });
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
    const parsed = portfolioMutationSchema.safeParse(decoded);
    if (!parsed.success)
      return json(
        {
          error:
            "Check the title, project URL, field lengths, and revision before saving.",
        },
        400,
      );
    const input = parsed.data;
    if ('draft' in input && input.draft.target && !portfolioTargetHref(input.draft.target))
      return json({ error: 'Choose an existing case-study page and section before saving.' }, 400);
    if (input.action === 'publish') {
      const saved = await db.rpc('cms_portfolio_entry', { p_id: input.id });
      if (saved.error) return json({ error: 'The saved project is unavailable. Check database setup.' }, 503);
      if (saved.data) {
        const entry = portfolioEntrySchema.parse(saved.data);
        if (entry.draft.target && !portfolioTargetHref(entry.draft.target))
          return json({ error: 'This draft links to a removed page or section. Choose another destination and save before publishing.' }, 400);
      }
    }
    const result = await db.rpc("cms_mutate_portfolio", {
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
              "This project changed in another session, or already exists. Reload before trying again.",
          },
          409,
        );
      if (message.includes("CMS_NOT_FOUND"))
        return json({ error: "Project not found." }, 404);
      if (message.includes("CMS_LIMIT"))
        return json(
          {
            error:
              "This release supports up to 200 portfolio projects in the deployed CMS.",
          },
          409,
        );
      if (message.includes("CMS_INVALID") || message.includes("CMS_IMAGE"))
        return json(
          {
            error:
              "A title, a valid page or HTTP(S) project URL, and any attached image are required to publish. Save your draft first.",
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
      { portfolio: portfolioEntrySchema.parse(result.data) },
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
