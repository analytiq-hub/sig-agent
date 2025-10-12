# DocRouter MCP Server (TypeScript)

A TypeScript-based Model Context Protocol (MCP) server for DocRouter API integration.

## Quick Start

```bash
# Install the package
npm install @docrouter/mcp

# Configure with your DocRouter credentials
export DOCROUTER_ORG_ID="your-org-id"
export DOCROUTER_ORG_API_TOKEN="your-token"

# Use in your MCP client configuration
```

## Publishing Quick Reference

```bash
# Build and test
npm run build && npm test

# Update version and publish
npm version patch && npm publish

# Check published package
npm view @docrouter/mcp
```

## Overview

This MCP server provides AI applications with access to DocRouter's document processing capabilities, including:

- Document management and retrieval
- OCR text extraction
- AI-powered data extraction using prompts
- Tag and prompt management
- Search functionality

## Installation

### For Users

Install the published package:

```bash
# Install locally
npm install @docrouter/mcp

# Or install globally
npm install -g @docrouter/mcp
```

### For Developers

Clone and install dependencies:

```bash
git clone <repository-url>
cd docrouter-mcp
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
      "args": ["node_modules/@docrouter/mcp/dist/index.js"],
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
      "args": ["node_modules/@docrouter/mcp/dist/index.js"],
      "env": {
        "DOCROUTER_ORG_ID": "your-org-id",
        "DOCROUTER_ORG_API_TOKEN": "your-token"
      }
    }
  }
}
```

### Claude Code

Create a `.mcp.conf` file in your project root:

```json
{
  "mcpServers": {
    "docrouter": {
      "command": "node",
      "args": ["node_modules/@docrouter/mcp/dist/index.js"],
      "env": {
        "DOCROUTER_ORG_ID": "your-org-id",
        "DOCROUTER_ORG_API_TOKEN": "your-token"
      }
    }
  }
}
```

### Using the Global Installation

If you installed the package globally, you can use the binary directly:

```json
{
  "mcpServers": {
    "docrouter": {
      "command": "docrouter-mcp",
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
- npm account with publish permissions

### Scripts

- `npm run build` - Build the project
- `npm run dev` - Build in watch mode
- `npm run start:dev` - Run in development mode
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Project Structure

```
src/
├── index.ts          # Main MCP server implementation
tests/
├── mcp-functionality.test.ts  # MCP functionality tests
├── mcp-server.test.ts         # Server integration tests
├── setup.ts                   # Test setup configuration
package.json          # Package configuration
tsconfig.json         # TypeScript configuration
tsup.config.ts        # Build configuration
jest.config.js        # Jest test configuration
README.md             # This file
```

## Publishing

### Prerequisites for Publishing

1. **npm Account**: Ensure you have an npm account and are logged in
2. **Organization Access**: You need publish permissions for the `@docrouter` organization
3. **Clean Working Directory**: All changes should be committed

### Publishing Steps

#### 1. Login to npm

```bash
npm login
```

Verify you're logged in:

```bash
npm whoami
```

#### 2. Prepare for Publishing

```bash
# Build the project
npm run build

# Run tests to ensure everything works
npm test

# Check what will be published
npm pack --dry-run
```

#### 3. Version Management

Update the version number in `package.json`:

```bash
# For bug fixes
npm version patch

# For new features (backward compatible)
npm version minor

# For breaking changes
npm version major
```

Or manually edit the version in `package.json`.

#### 4. Publish the Package

```bash
npm publish
```

#### 5. Verify Publication

Check that your package is available:

```bash
# View package info
npm view @docrouter/mcp

# Test installation
npm install @docrouter/mcp
```

### Package Configuration

The package is configured as a scoped package with the following key settings:

```json
{
  "name": "@docrouter/mcp",
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "dist",
    "README.md"
  ]
}
```

### What Gets Published

The following files are included in the published package:

- `dist/` - Built JavaScript files (CommonJS + ES Modules)
- `dist/docs/knowledge_base/` - Bundled knowledge base files
- `README.md` - Documentation
- `package.json` - Package metadata

### Updating the Package

To publish updates:

1. Make your changes
2. Update the version: `npm version patch|minor|major`
3. Build and test: `npm run build && npm test`
4. Publish: `npm publish`

### Troubleshooting

#### Package Already Exists
If you get an error that the package already exists:
- Check the version number - it must be unique
- Use `npm version patch` to increment the version

#### Permission Denied
If you get permission errors:
- Ensure you're logged in: `npm whoami`
- Check you have publish permissions for `@docrouter` organization
- Contact the organization admin if needed

#### Build Errors
If the build fails:
- Check TypeScript errors: `npm run type-check`
- Ensure all dependencies are installed: `npm install`
- Check the `tsup.config.ts` configuration

### Unpublishing (Emergency Only)

⚠️ **Warning**: Only unpublish within 72 hours and if absolutely necessary.

```bash
# Unpublish a specific version
npm unpublish @docrouter/mcp@0.1.0

# Unpublish entire package (use with caution)
npm unpublish @docrouter/mcp --force
```

**Note**: Unpublishing blocks republishing the same version for 24 hours.

## Error Handling

The server includes comprehensive error handling and will return structured error responses for debugging. All errors are logged to stderr to avoid interfering with MCP communication.

## License

MIT
