# DocRouter MCP Server

## Development Setup
```bash
export DOCROUTER_URL=https://app.docrouter.ai/fastapi
export DOCROUTER_ORG_ID=<orgid>
export DOCROUTER_ORG_API_TOKEN=<token>
npx @modelcontextprotocol/inspector python docrouter_mcp_server.py 
```

## Claude Desktop JSON Configuration

```json
{
  "name": "DocRouter MCP Server",
  "description": "A tool for interacting with DocRouter",
  "url": "http://localhost:8000"
}
```