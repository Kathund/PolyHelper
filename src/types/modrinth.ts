import zod from 'zod';

export const ModrinthProject = zod.object({
  slug: zod.string(),
  title: zod.string(),
  description: zod.string(),
  source_url: zod.string().nullish(),
  issues_url: zod.string().nullish()
});
export type ModrinthProject = zod.infer<typeof ModrinthProject>;

export const ModrinthSearchResponse = zod.object({ hits: zod.array(zod.object({ slug: zod.string() })) });
export type ModrinthSearchResponse = zod.infer<typeof ModrinthSearchResponse>;
