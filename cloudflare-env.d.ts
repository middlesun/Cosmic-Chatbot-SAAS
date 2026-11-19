interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

declare module 'cloudflare:node' {
  export function httpServerHandler(options: { port: number }): {
    fetch: (request: Request, env: unknown, ctx: WorkerExecutionContext) => Promise<Response>;
  };
}
