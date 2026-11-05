import { projectSchema, type Project } from "./schema";
import {
  emptyService,
  servicePayloadSchema,
  publishedServiceSchema,
  type ServicePayload,
  type PublicService,
} from "./service-schema";
export const serviceCollectionDefaults = {
  title: "Our services",
  description: "Explore how we can help.",
  mobile: 1,
  tablet: 2,
  desktop: 3,
  gap: 24,
  design: 'classic' as const,
  motion: 'none' as const,
};
export function publicServices(project: Project): PublicService[] {
  return project.content.services
    .flatMap((entry) =>
      entry.published ? [{ id: entry.id, ...entry.published }] : [],
    )
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}
export function addServiceCollection(
  project: Project,
  pageId: string,
): Project {
  return projectSchema.parse({
    ...project,
    updatedAt: new Date().toISOString(),
    pages: project.pages.map((page) =>
      page.id !== pageId ||
      page.nodes.some((node) => node.type === "ServiceCollection")
        ? page
        : {
            ...page,
            nodes: [
              ...page.nodes,
              {
                id: crypto.randomUUID(),
                type: "ServiceCollection",
                props: serviceCollectionDefaults,
              },
            ],
          },
    ),
  });
}
export function createService(project: Project): {
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
        services: [
          ...project.content.services,
          {
            id,
            draft: emptyService(),
            published: null,
            revision: 1,
            publishedRevision: null,
          },
        ],
      },
    }),
  };
}
export function mutateService(
  project: Project,
  id: string,
  action: "save" | "publish" | "unpublish",
  expectedRevision: number,
  draft?: ServicePayload,
): Project {
  const entry = project.content.services.find((item) => item.id === id);
  if (!entry) throw new Error("Service not found.");
  if (entry.revision !== expectedRevision)
    throw new Error("This service changed. Reopen it before saving.");
  const revision = entry.revision + 1;
  const updated =
    action === "save"
      ? { ...entry, draft: servicePayloadSchema.parse(draft), revision }
      : action === "publish"
        ? {
            ...entry,
            published: structuredClone(
              publishedServiceSchema.parse(entry.draft),
            ),
            revision,
            publishedRevision: revision,
          }
        : { ...entry, published: null, revision, publishedRevision: null };
  return projectSchema.parse({
    ...project,
    updatedAt: new Date().toISOString(),
    content: { ...project.content,
      services: project.content.services.map((item) =>
        item.id === id ? updated : item,
      ),
    },
  });
}
