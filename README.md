# Agents-for-Humans
Everyday, maybe Day 1 and Day 2, people are struggling to complete repetitive tasks like printing bills, scheduling a hygiene, or filling out the checklist again. On their own they're minor, but together they drain real time and attention. Agents for Humans take care of your last year tasks for now.

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


## Option 2: Strands + Bedrock service

The production request path is:

```text
Frontend → Cloudflare Worker → API Gateway → Lambda → Strands Agent → Bedrock
```

The TypeScript Strands Agent runs in AWS Lambda. The Cloudflare Worker handles application authentication and proxies requests. Lambda uses its AWS IAM role for Bedrock access. See [backend/option-2.md](./backend/option-2.md) for deployment instructions.
