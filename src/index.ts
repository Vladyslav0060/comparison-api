import { startRefi } from "./refi";
import { Request_1031_Props, Env } from "./types/types";
import { start } from "./worker";

async function fetch(request: Request, env: Env, ctx: ExecutionContext) {
  try {
    if (request.method !== "POST")
      return new Response(
        `Request was sent with "${request.method}" method, only "POST" allowed`
      );
    let response;
    const body: Request_1031_Props = await request.json();
    switch (body.scenario_type) {
      case "1031":
        response = await start(body, env);
        break;
      case "refi":
        response = await startRefi(body, env);
        break;
      default:
        throw new Error("Scenario type is not found");
    }
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
