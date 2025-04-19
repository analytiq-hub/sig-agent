# DocRouter MCP Server

## Development Setup
```bash
export DOCROUTER_URL=https://app.docrouter.ai/fastapi
export DOCROUTER_ORG_ID=<orgid>
export DOCROUTER_ORG_API_TOKEN=<token>
npx @modelcontextprotocol/inspector python docrouter_mcp_server.py 
```

## Claude Desktop JSON Configuration
* Run `git clone https://github.com/analytiq-hub/doc-router`
* `cd doc-router/packages/docrouter_mcp/`
* `python -m venv .venv`
* `source .venv/bin/activate`
* `pip install -r requirements.txt`
* `python docrouter_mcp_server.py`
* Update the claude desktop config json file with the following:
```json
{
  "mcpServers": {
    "docrouter": {
      "command": "/Users/<username>/doc-router/packages/docrouter_mcp/.venv/bin/python",
      "args": [
        "/Users/<username>/doc-router/packages/docrouter_mcp/docrouter_mcp_server.py"
      ],
      "env": {
        "DOCROUTER_URL": "https://app.docrouter.ai/fastapi",
        "DOCROUTER_ORG_ID": "679c9a914cfaaaa3640811ed",
        "DOCROUTER_ORG_API_TOKEN": "sLG8kB2El8d-YMvLk4eWBxfEBvvzMUu97SivSpmnPXs"
      }
    }
  }
}
```
* Restart Claude Desktop
* Query the DocRouter MCP Server through Claude Desktop