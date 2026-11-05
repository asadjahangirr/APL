import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  normalizeArticleImage,
  MAX_ARTICLE_IMAGE_BYTES,
} from "../lib/article-image-codec.mjs";

const slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const image = z.union([
  z.literal(""),
  z
    .string()
    .max(3000000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
]);
const payload = z
  .object({
    title: z.string().max(120),
    slug: z.union([z.literal(""), slug]),
    summary: z.string().max(320),
    body: z.string().max(12000),
    image,
    imageAlt: z.string().max(240),
  })
  .strict();
const publication = payload.refine(
  (value) => value.title.trim().length > 0 && value.slug.length > 0,
);
const entry = z
  .object({
    id: z.string().uuid(),
    draft: payload,
    published: publication.nullable(),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    publishedRevision: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
  })
  .strict()
  .refine((value) =>
    value.published
      ? value.publishedRevision !== null &&
        value.publishedRevision <= value.revision
      : value.publishedRevision === null,
  );
const seedPath = new URL("../articles-seed.json", import.meta.url);
if ((await stat(seedPath)).size > 10 * 1024 * 1024)
  throw new Error(
    "Initial content is too large. Download a validated export again.",
  );
let decoded;
try {
  decoded = JSON.parse(await readFile(seedPath, "utf8"));
} catch {
  throw new Error(
    "Initial content is not valid JSON. Download a validated export again.",
  );
}
const parsed = z.array(entry).max(50).safeParse(decoded);
if (!parsed.success)
  throw new Error(
    "Initial content is invalid. Download a validated export again; no database records were changed.",
  );
const entries = parsed.data.map((value) => ({
  ...value,
  id: value.id.toLowerCase(),
}));
if (new Set(entries.map((value) => value.id)).size !== entries.length)
  throw new Error("Initial content contains duplicate article IDs.");
const publishedSlugs = entries.flatMap((value) =>
  value.published ? [value.published.slug] : [],
);
if (new Set(publishedSlugs).size !== publishedSlugs.length)
  throw new Error("Initial content contains duplicate published URL slugs.");
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env;
if (!url || !key)
  throw new Error(
    "Set your own Supabase URL and server-only SUPABASE_SECRET_KEY in .env.local before importing content.",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const existing = await db.from("cms_articles").select("id");
if (existing.error)
  throw new Error(
    "Content database is unavailable. Check owner credentials and apply the Articles migration first.",
  );
const known = new Set(existing.data.map((value) => value.id));
let imported = 0,
  skipped = 0;
const bucket = db.storage.from("cms-article-media");

async function importImage(articleId, dataUri) {
  if (!dataUri) return "";
  const match = dataUri.match(
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match) throw new Error("An initial image has an invalid format.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_ARTICLE_IMAGE_BYTES)
    throw new Error("An initial image exceeds the 2 MB limit.");
  let output;
  try {
    output = await normalizeArticleImage(bytes, match[1]);
  } catch {
    throw new Error(
      "An initial image cannot be decoded safely. Use a non-animated PNG, JPEG, or WebP image under 24 million pixels.",
    );
  }
  const hash = createHash("sha256").update(output).digest("hex");
  const path = `${articleId}/seed-${hash}.webp`;
  const upload = await bucket.upload(path, output, {
    contentType: "image/webp",
    upsert: false,
    cacheControl: "0",
  });
  if (upload.error) {
    // A previous interrupted import may already have uploaded the same immutable file.
    const previous = await bucket.download(path);
    if (
      previous.error ||
      !previous.data ||
      createHash("sha256")
        .update(Buffer.from(await previous.data.arrayBuffer()))
        .digest("hex") !== hash
    ) {
      throw new Error(
        "Initial image upload failed. Check the private bucket, storage quota, and owner credentials. Existing content has not been overwritten.",
      );
    }
  }
  return path;
}

for (const record of entries) {
  if (known.has(record.id)) {
    skipped++;
    continue;
  }
  const draftImage = await importImage(record.id, record.draft.image);
  const publishedImage = record.published
    ? record.published.image === record.draft.image
      ? draftImage
      : await importImage(record.id, record.published.image)
    : "";
  const result = await db.rpc("cms_import_article", {
    p_entry: {
      ...record,
      draft: { ...record.draft, image: draftImage },
      published: record.published
        ? { ...record.published, image: publishedImage }
        : null,
    },
  });
  if (result.error) {
    if (result.error.code === "23505")
      throw new Error(
        "An initial published URL conflicts with an existing article. Change the initial slug and export again. Existing records were preserved.",
      );
    throw new Error(
      "Initial content import failed. Check migrations, unique URLs, and the 200-article CMS limit. Completed imports remain intact; running this command again safely skips existing IDs.",
    );
  }
  if (result.data === true) imported++;
  else skipped++;
}
console.log(
  `Initial content: ${imported} article(s) imported; ${skipped} existing article(s) preserved. Manage subsequent content changes in /admin.`,
);
