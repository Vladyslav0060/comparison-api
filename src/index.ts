import { startRefi } from "./refi";
import { Request_1031_Props, Env } from "./types/types";
import { start } from "./worker";

async function fetch(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method !== "POST")
    return new Response(
      `Request was sent with "${request.method}" method, only "POST" allowed`
    );
  const body: Request_1031_Props = await request.json();
  console.log(body);
  const response =
    body.scenario_type === "1031"
      ? await start(body, env)
      : await startRefi(body, env);
  return new Response(JSON.stringify(response), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

export default {
  fetch,
};
