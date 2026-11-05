import "server-only";
import { database } from "./server";
import { publishedPortfolioSchema, type PortfolioPayload } from "./portfolio-schema";
import { portfolioTargetHref } from './portfolio-target';

export type PublicPortfolio = PortfolioPayload & { id: string; href?: string };
function portfolioHref(payload: PortfolioPayload): string | undefined {
  if (!payload.target) return payload.externalUrl || undefined;
  return portfolioTargetHref(payload.target);
}
export async function listPortfolio(): Promise<PublicPortfolio[]> {
  const result = await database()
    .from("cms_portfolio_publications")
    .select("id,payload")
    .order("id", { ascending: true })
    .limit(200);
  if (result.error) throw new Error(
    "Portfolio projects are unavailable. Apply the database migrations and import initial content.",
  );
  return result.data.map(row => {
    const payload = publishedPortfolioSchema.parse(row.payload);
    return {
      ...payload,
      id: row.id,
      href: portfolioHref(payload),
      image: payload.image ? `/api/portfolio/${row.id}/image` : "",
    };
  }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}
