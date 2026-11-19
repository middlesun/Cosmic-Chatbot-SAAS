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

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: WorkerExecutionContext
  ): Promise<Response> {
    // Sync Worker environment variables & secrets into process.env for Node-compatible modules
    if (env && typeof env === 'object') {
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string' && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/') && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return runWithWaitUntil(
      (promise) => ctx.waitUntil(promise),
      () => nodeHandler.fetch(request, env, ctx)
    );
  },
};
