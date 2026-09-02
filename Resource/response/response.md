# Response traces

Runtime model responses are stored in Cloudflare R2 under the `response/`
prefix, not as files in this source directory. The Worker writes one readable
JSON object per successful provider response. Use `GET /api/responses` to list
trace keys and `GET /api/responses/<key>` to retrieve one.

The Cloudflare Worker cannot write into this repository at request time. Sync
is intentionally manual so the project does not continuously poll Cloudflare.
To download new R2 objects into this folder, run this command whenever needed:

```bash
npm run sync:responses
```

The destination is always the `resource/response/` folder in the repository where the
command is run; it does not depend on a fixed absolute path. There is no
automatic timer or background watcher.

Set `RESPONSE_API_BASE_URL` to use another deployed Worker or a local Wrangler
server. For example, in PowerShell:

```powershell
$env:RESPONSE_API_BASE_URL = "http://localhost:8787"
npm run sync:responses
```

Downloaded JSON files are local runtime data and are ignored by Git.
After every sync, the script deletes the oldest local JSON traces when needed
so that only the eight newest responses remain.
