export function runScheduled(
  path: string,
  context: { deploy?: { context: string; published: boolean } },
  env?: Record<string, string | undefined>,
  fetcher?: typeof fetch,
): Promise<Response>;
