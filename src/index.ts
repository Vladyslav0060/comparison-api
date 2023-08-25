import { Request_1031_Props } from "./types/types";
import { start } from "./worker";

export interface Env {
  FORECASTING_URL: string;
  AMORTIZATION_URL: string;
}

async function fetch(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method !== "POST")
    return new Response(
      `Request was sent with "${request.method}" method, only "POST" allowed`
    );
  const body: Request_1031_Props = await request.json();
  await start(body, env);
  return new Response(body.scenario_level);
}

export default {
  fetch,
};
