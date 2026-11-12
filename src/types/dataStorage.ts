import zod from 'zod';

export const OneClientBundlesMetadatVersionItem = zod.object({ path: zod.string(), sha1: zod.string() });
export const OneClientBundlesMetadatVersion = zod.object({
  fabric: zod.array(OneClientBundlesMetadatVersionItem).optional(),
  ornithe: zod.array(OneClientBundlesMetadatVersionItem).optional()
});
export const OneClientBundlesMetadata = zod.object({
  versions: zod.record(zod.string(), OneClientBundlesMetadatVersion)
});
export type OneClientBundlesMetadata = zod.infer<typeof OneClientBundlesMetadata>;

export const OneClientModOverrides = zod.object({
  name: zod.string().optional(),
  description: zod.string().optional(),
  authors: zod.array(zod.string()).optional(),
  icon: zod.url().optional()
});
export const OneClientModDownload = zod.object({ 'url': zod.url(), 'hash-format': zod.string(), 'hash': zod.string() });
export const OneClientModUpdateModrinth = zod.object({ 'mod-id': zod.string(), 'version': zod.string() });
export const OneClientModUpdateGithub = zod.object({
  slug: zod.string(),
  tag: zod.string(),
  branch: zod.string().optional(),
  regex: zod.string()
});
export const OneClientModUpdate = zod.object({
  modrinth: OneClientModUpdateModrinth.optional(),
  github: OneClientModUpdateGithub.optional()
});
export const OneClientMod = zod.object({
  id: zod.string(),
  enabled: zod.boolean(),
  hidden: zod.boolean(),
  name: zod.string(),
  filename: zod.string(),
  side: zod.enum(['both', 'client', 'server']),
  type: zod.string().default('normal'),
  overrides: OneClientModOverrides.optional(),
  download: OneClientModDownload,
  update: OneClientModUpdate
});
export type OneClientMod = zod.infer<typeof OneClientMod>;
