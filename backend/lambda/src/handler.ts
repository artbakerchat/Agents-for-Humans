import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { Agent, BedrockModel } from "@strands-agents/sdk";

type ModelRequest = {
  prompt: string;
  instructions?: string;
};

const region = process.env.AWS_REGION ?? "us-east-1";
const modelId = process.env.BEDROCK_MODEL_ID ?? "us.amazon.nova-lite-v1:0";

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method === "GET" && event.rawPath === "/health") {
    return response(200, { status: "ok", service: "strands-bedrock-lambda", region, modelId });
  }

  if (event.requestContext.http.method !== "POST") {
    return response(405, { error: "method_not_allowed" });
  }

  let request: ModelRequest;
  try {
    request = JSON.parse(event.body ?? "") as ModelRequest;
  } catch {
    return response(400, { error: "invalid_json" });
  }

  if (!request.prompt || request.prompt.length > 20_000) {
    return response(400, { error: "prompt_required_or_too_long" });
  }

  const prompt = request.instructions
    ? `${request.instructions}\n\nUser prompt:\n${request.prompt}`
    : request.prompt;

  try {
    const agent = new Agent({
      model: new BedrockModel({ modelId, region, temperature: 0.2 }),
    });
    const result = await agent.invoke(prompt);

    return response(200, { modelId, region, response: result.lastMessage });
  } catch (error) {
    console.error("Strands invocation failed", error);
    return response(502, { error: "bedrock_invocation_failed" });
  }
}
