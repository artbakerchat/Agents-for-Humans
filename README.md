# Agents-for-Humans
Everyday, maybe Day 1 and Day 2, people are struggling to complete repetitive tasks like printing bills, scheduling a hygiene, or filling out the checklist again. On their own they're minor, but together they drain real time and attention. Agents for Humans take care of your last year tasks for now.

https://builder.aws.com/content/3IpRW9t9u9OT2uzaT5gNRFIsozt/open-for-neighbours

## Articles
https://builder.aws.com/content/3Ibk3sjdeaROv4MknrRRZWqSxhU/agents-for-humans

## Diagram
User question: Where is Harry Potter? . . . . .
Agent question: Where is Hulk? I like Spider-man.

### Good Neighbor Agents

Good Neighbor Agents are AI agents designed to serve **groups of people and community organizations**, not just individual users. They are built for:

- 🏘️ **Neighborhoods** – local communication, resource sharing, safety alerts
- 🤝 **Nonprofits** – donor outreach, volunteer coordination, grant tracking
- 🥫 **Food Banks** – inventory management, client scheduling, donation drives
- 🏫 **Schools** – parent communication, event planning, resource distribution
- 📚 **Libraries** – program scheduling, community FAQ, digital resource guidance
- 🏡 **Small Local Organizations** – meeting, newsletter, member support
- **Quebec** -
- **Park de Churros** -

See [Good-Neighbor-Agents.md](./Good-Neighbor-Agents.md) for detailed use cases and implementation guidance.

## Local Cloudflare development

Install dependencies in the repository and in `backend/worker`, then create the Worker
development environment:

```sh
cp backend/worker/.dev.vars.example backend/worker/.dev.vars
# Edit API_GATEWAY_URL if needed
npm run dev:cloudflare
```

This starts Vite and Wrangler together. The frontend is available at the Vite URL and
proxies `/api/*` requests to the local Worker at `http://127.0.0.1:8787`.

## Cloudflare Worker Git deployment

The frontend is deployed as static assets by a Cloudflare Worker. In the Workers Git
integration project settings, set:

```text
Build command: npm run build
Deploy command: npm run deploy
Root directory: /
```

Set `API_WORKER_URL` in the Worker Git integration variables to the deployed gateway
Worker URL. The frontend sends `/api/*` requests to the same origin, and the frontend
Worker proxies them to that gateway. Deploy the gateway Worker separately as described
in [backend/option-2.md](./backend/option-2.md).

The Worker deployment can be tested locally with:

```sh
npm run preview
```

Deploy from the repository manually with:

```sh
npm run deploy
```

The API gateway is a separate Cloudflare Worker in `backend/worker`, configured and
deployed independently from the frontend Worker.


## Option 2: Strands + Bedrock service

The production request path is:

```text
Frontend → Cloudflare Worker → API Gateway → Lambda → Strands Agent → Bedrock
```

The TypeScript Strands Agent runs in AWS Lambda. The Cloudflare Worker handles application authentication and proxies requests. Lambda uses its AWS IAM role for Bedrock access. See [backend/option-2.md](./backend/option-2.md) for deployment instructions.
