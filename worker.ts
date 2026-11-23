import { httpServerHandler } from 'cloudflare:node';
import { createExpressApp } from './server/app';
import { runWithWaitUntil } from './server/lib/backgroundTask';

interface WorkerEnv {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  [key: string]: unknown;
}

const app = createExpressApp();
app.listen(3000);

const nodeHandler = httpServerHandler({ port: 3000 });

const NOINDEX_CLASSIC_PREFIXES = [
  '/legacy',
  '/classic',
  '/written-consultations',
  '/pay',
  '/book',
  '/why-us',
  '/contact',
  '/services',
];

function shouldNoIndex(url: URL): boolean {
  if (url.hostname.startsWith('classic.') || url.hostname.startsWith('legacy.')) {
    return true;
  }
  return NOINDEX_CLASSIC_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  );
}

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: WorkerExecutionContext
  ): Promise<Response> {
    // Sync Worker environment variables & secrets into process.env for Node-compatible modules
    if (env && typeof env === 'object') {
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string' && value.length > 0 && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/') && env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      if (shouldNoIndex(url)) {
        const headers = new Headers(assetRes.headers);
        headers.set('X-Robots-Tag', 'noindex, nofollow');
        return new Response(assetRes.body, {
          status: assetRes.status,
          statusText: assetRes.statusText,
          headers,
        });
      }
      return assetRes;
    }

    return runWithWaitUntil(
      (promise) => ctx.waitUntil(promise),
      () => nodeHandler.fetch(request, env, ctx)
    );
  },
};
