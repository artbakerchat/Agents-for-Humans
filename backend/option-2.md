# Option 2: Cloudflare Worker + API Gateway + Lambda + Strands + Bedrock

The request path is:

```text
Frontend → Cloudflare Worker → API Gateway → Lambda → Strands Agent → Bedrock
```

## AWS deployment

From this directory, install the Lambda dependencies and deploy with AWS SAM:

```bash
cd lambda
npm install
npx sam build
npx sam deploy --guided
```

The Lambda execution role grants Bedrock invocation permissions. No AWS access keys are stored in Cloudflare.

## Cloudflare deployment

Set the API Gateway URL in `worker/wrangler.toml`, then install and deploy:

```bash
cd worker
npm install
npx wrangler secret put APP_AUTH_TOKEN
npm run deploy
```

The frontend should call the Worker URL with `Authorization: Bearer <application-token>`.
