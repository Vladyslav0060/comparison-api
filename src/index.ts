import { Request_1031_Props } from "./types/types";
import { start } from "./worker";

export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
}

async function fetch(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method !== "POST")
    return new Response(
      `Request was sent with "${request.method}" method, only "POST" allowed`
    );
  const body: Request_1031_Props = await request.json();
  await start(body);
  return new Response(body.scenario_level);
}

export default {
  fetch,
};
