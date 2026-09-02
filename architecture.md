# Frontend clone architecture

This folder is organized as a standalone static site clone of the original application. It preserves the layout, content structure, interaction patterns, and navigation set while remaining completely browser-only.

## Current state

- HTML pages copied from the original app
- CSS reused and adapted to match the original visual design
- JavaScript behaviors preserved from the source site
- No server app scaffold or runtime entrypoint

## Planned Cloudflare + AWS evolution

Cloudflare is the public edge layer, while AWS owns the application runtime and model access. This keeps the static site fast and protected without trying to run the Node-oriented Strands runtime inside a V8-isolate Worker.

### Target direction

- Edge: Cloudflare DNS, CDN/cache rules, and WAF
- Frontend: static pages served from Cloudflare Pages or an S3 origin
- API entrypoint: API Gateway
- Application runtime: Node.js Lambda
- Agent runtime: Strands + Amazon Bedrock
- State: DynamoDB or Aurora as needed
- Media and artifacts: S3
- Observability: CloudWatch

### Request flow

1. The browser requests static HTML, CSS, JavaScript, and media through Cloudflare.
2. Cloudflare caches immutable assets at edge locations.
3. Cloudflare WAF and rate limits inspect public API traffic before it reaches AWS.
4. Allowed AI requests go to API Gateway and a Node.js Lambda function.
5. The Lambda function invokes Strands and Bedrock using AWS IAM permissions.
6. Responses return through API Gateway and Cloudflare to the browser.

### Boundary rule

Keep `@strands-agents/sdk`, AWS credentials, Bedrock calls, and private tools in Lambda. Cloudflare Workers may remain useful for lightweight edge routing or request filtering, but they should not contain the Strands runtime unless its Node compatibility requirements are explicitly verified.

## Migration goal

Keep the same product feel and full navigation layout while moving the AI runtime away from the original Cloudflare/OpenAI/Gemini stack toward AWS-native orchestration.

## Important note

This is intentionally a frontend preservation step first. The runtime migration happens after the site clone is complete and a proper Node environment is available.
