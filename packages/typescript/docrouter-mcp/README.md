# DocRouter MCP Server (TypeScript)

A TypeScript-based Model Context Protocol (MCP) server for DocRouter API integration.

## Overview

This MCP server provides AI applications with access to DocRouter's document processing capabilities, including:

- Document management and retrieval
- OCR text extraction
- AI-powered data extraction using prompts
- Tag and prompt management
- Search functionality

## Installation

```bash
npm install
```

## Configuration

The server can be configured using environment variables or command line arguments:

### Environment Variables

- `DOCROUTER_API_URL` - DocRouter API base URL (default: https://app.docrouter.ai/fastapi)
- `DOCROUTER_ORG_ID` - Your DocRouter organization ID (required)
- `DOCROUTER_ORG_API_TOKEN` - Your DocRouter organization API token (required)

### Command Line Arguments

- `--url` - DocRouter API base URL
- `--org-id` - DocRouter organization ID
- `--org-token` - DocRouter organization API token
- `--timeout` - Request timeout in milliseconds (default: 30000)
- `--retries` - Number of retry attempts (default: 3)

## Usage

### Running the Server

```bash
# Using environment variables
npm start

# Using command line arguments
npm start -- --org-id your-org-id --org-token your-token

# Development mode
npm run start:dev
```

### Building

```bash
npm run build
```

## Available Tools

### Document Tools
- `get_docrouter_documents()` - List all documents
- `get_docrouter_document(documentId)` - Get document by ID
- `get_docrouter_document_ocr(documentId)` - Get raw OCR text for a document
- `get_docrouter_document_ocr_metadata(documentId)` - Get OCR metadata for a document
- `get_docrouter_extraction(documentId, promptRevId)` - Get extraction results

### Tag Tools
- `get_docrouter_tags()` - List all tags
- `get_docrouter_tag(tagId)` - Get tag by ID

### Prompt Tools
- `get_docrouter_prompts()` - List all prompts
- `get_docrouter_prompt(promptRevId)` - Get prompt by ID

### Search and Extraction Tools
- `search_docrouter_documents(query, tagIds)` - Search documents by name
- `search_docrouter_prompts(query)` - Search prompts by name or content
- `search_docrouter_tags(query)` - Search tags by name or description
- `run_docrouter_extraction(documentId, promptRevId, force)` - Run AI extraction on a document

### Helper Tools
- `docrouter_help()` - Get help information about using the DocRouter API
- `docrouter_document_analysis_guide(documentId)` - Generate a guide to analyze a specific document

## Example Workflows

### 1. Find and Analyze Documents

```typescript
// Search for invoice documents
const documents = await search_docrouter_documents("invoice");

// Get OCR text for the first document
const ocrText = await get_docrouter_document_ocr(documents.documents[0].id);

// Find available prompts
const prompts = await get_docrouter_prompts();

// Run extraction with a specific prompt
const extraction = await run_docrouter_extraction(
  documents.documents[0].id, 
  prompts.prompts[0].id
);
```

### 2. Document Analysis Guide

```typescript
// Get a step-by-step guide for analyzing a document
const guide = await docrouter_document_analysis_guide("document-id");
```

## Integration with AI Applications

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docrouter": {
      "command": "node",
      "args": ["/path/to/docrouter-mcp/dist/index.js"],
      "env": {
        "DOCROUTER_ORG_ID": "your-org-id",
        "DOCROUTER_ORG_API_TOKEN": "your-token"
      }
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "docrouter": {
      "command": "node",
      "args": ["/path/to/docrouter-mcp/dist/index.js"],
      "env": {
        "DOCROUTER_ORG_ID": "your-org-id",
        "DOCROUTER_ORG_API_TOKEN": "your-token"
      }
    }
  }
}
```

## Development

### Prerequisites

- Node.js 18+
- TypeScript 5+
- Access to DocRouter API

### Scripts

- `npm run build` - Build the project
- `npm run dev` - Build in watch mode
- `npm run start:dev` - Run in development mode
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Project Structure

```
src/
├── index.ts          # Main MCP server implementation
package.json          # Package configuration
tsconfig.json         # TypeScript configuration
tsup.config.ts        # Build configuration
README.md             # This file
```

## Error Handling

The server includes comprehensive error handling and will return structured error responses for debugging. All errors are logged to stderr to avoid interfering with MCP communication.

## License

MIT
