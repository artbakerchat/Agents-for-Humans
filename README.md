# Agents-for-Humans
Deploying with AgentCore is a smart architectural choice and will strengthen your Implementation score.

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


## Option 2: Strands + Bedrock service

The production request path is:

```text
Frontend → Cloudflare Worker → API Gateway → Lambda → Strands Agent → Bedrock
```

The TypeScript Strands Agent runs in AWS Lambda. The Cloudflare Worker handles application authentication and proxies requests. Lambda uses its AWS IAM role for Bedrock access. See [backend/option-2.md](./backend/option-2.md) for deployment instructions.
