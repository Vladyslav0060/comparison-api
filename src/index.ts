import { startRefi } from "./refi";
import { Request_1031_Props, Env } from "./types/types";
import { start } from "./worker";

async function fetch(request: Request, env: Env, ctx: ExecutionContext) {
  try {
    if (request.method !== "POST")
      return new Response(
        `Request was sent with "${request.method}" method, only "POST" allowed`
      );
    const body: Request_1031_Props = await request.json();
    const response =
      body.scenario_type === "1031"
        ? await start(body, env)
        : await startRefi(body, env);
    console.log("1", response);
    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("❌ fetch: ", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "content-type": "application/json" },
      status: 500,
    });
  }
}

export default {
  fetch,
};
