# SigAgent MCP Server Installation and Setup Guide

## Overview

The SigAgent MCP (Model Context Protocol) Server provides AI applications with seamless access to SigAgent's document processing capabilities. This guide covers everything you need to know to install, configure, and use the SigAgent MCP server.

## What is the SigAgent MCP Server?

The SigAgent MCP Server is a TypeScript-based server that implements the Model Context Protocol, allowing AI applications like Claude Desktop, Cursor IDE, and other MCP-compatible tools to interact with SigAgent's API for:

- Document management and retrieval
- OCR text extraction
- AI-powered data extraction using prompts
- Tag and prompt management
- Search functionality

## Installation Methods

### Method 1: Global Installation (Recommended)

Install the package globally to make the `sigagent-mcp` binary available system-wide:

```bash
npm install -g @sigagent/mcp
```

After installation, verify the binary is available:

```bash
which sigagent-mcp
# Should output: /path/to/node/bin/sigagent-mcp

# Test the installation
sigagent-mcp --help
```

### Method 2: Local Installation

Install the package locally in your project:

```bash
npm install @sigagent/mcp
```

This method requires you to reference the full path to the executable in your MCP configuration.

## Prerequisites

Before setting up the MCP server, ensure you have:

1. **Node.js 18+** installed on your system
2. **SigAgent Account** with API access
3. **SigAgent Credentials**:
   - Organization ID (`SIGAGENT_ORG_ID`)
   - Organization API Token (`SIGAGENT_ORG_API_TOKEN`)
   - API URL (optional, defaults to production)

## Configuration

### Environment Variables

The MCP server can be configured using environment variables:

```bash
export SIGAGENT_API_URL="https://app.sigagent.ai/fastapi"
export SIGAGENT_ORG_ID="your-org-id"
export SIGAGENT_ORG_API_TOKEN="your-api-token"
```

### MCP Configuration Files

The configuration depends on which AI application you're using:

#### For Cursor IDE

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "sigagent": {
      "command": "sigagent-mcp",
      "env": {
        "SIGAGENT_API_URL": "https://app.sigagent.ai/fastapi",
        "SIGAGENT_ORG_ID": "your-org-id",
        "SIGAGENT_ORG_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

#### For Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sigagent": {
      "command": "sigagent-mcp",
      "env": {
        "SIGAGENT_API_URL": "https://app.sigagent.ai/fastapi",
        "SIGAGENT_ORG_ID": "your-org-id",
        "SIGAGENT_ORG_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

#### For Local Installation

If you installed locally, use the full path:

```json
{
  "mcpServers": {
    "sigagent": {
      "command": "node",
      "args": ["node_modules/@sigagent/mcp/dist/index.js"],
      "env": {
        "SIGAGENT_API_URL": "https://app.sigagent.ai/fastapi",
        "SIGAGENT_ORG_ID": "your-org-id",
        "SIGAGENT_ORG_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Step-by-Step Setup

### 1. Install the Package

```bash
# Global installation (recommended)
npm install -g @sigagent/mcp

# Or local installation
npm install @sigagent/mcp
```

### 2. Verify Installation

```bash
# Check if binary is available (global install)
which sigagent-mcp

# Or check package installation (local install)
npm list @sigagent/mcp
```

### 3. Create Configuration File

For **Cursor IDE**, create `.mcp.json`:

```bash
touch .mcp.json
```

### 4. Add Configuration

Copy the appropriate configuration from above and replace:
- `your-org-id` with your actual SigAgent organization ID
- `your-api-token` with your actual SigAgent API token
- `https://app.sigagent.ai/fastapi` with your API URL (if different)

### 5. Test the Configuration

Test the MCP server manually:

```bash
# Set environment variables
export SIGAGENT_ORG_ID="your-org-id"
export SIGAGENT_ORG_API_TOKEN="your-api-token"

# Run the server directly
sigagent-mcp
```

## Available MCP Tools

Once configured, the following tools become available in your AI application:

### Document Management
- `get_sigagent_documents()` - List all documents
- `get_sigagent_document(documentId)` - Get document by ID
- `get_sigagent_document_ocr(documentId)` - Get raw OCR text
- `get_sigagent_document_ocr_metadata(documentId)` - Get OCR metadata

### Data Extraction
- `run_sigagent_extraction(documentId, promptRevId, force)` - Run AI extraction
- `get_sigagent_extraction(documentId, promptRevId)` - Get extraction results

### Search and Discovery
- `search_sigagent_documents(query, tagIds)` - Search documents
- `search_sigagent_prompts(query)` - Search prompts
- `search_sigagent_tags(query)` - Search tags

### Management
- `get_sigagent_prompts()` - List all prompts
- `get_sigagent_prompt(promptRevId)` - Get prompt by ID
- `get_sigagent_tags()` - List all tags
- `get_sigagent_tag(tagId)` - Get tag by ID

### Help and Guidance
- `sigagent_help()` - Get help information
- `sigagent_document_analysis_guide(documentId)` - Generate analysis guide

## Example Workflows

### 1. Document Analysis Workflow

```typescript
// Search for invoice documents
const documents = await search_sigagent_documents("invoice");

// Get OCR text for the first document
const ocrText = await get_sigagent_document_ocr(documents.documents[0].id);

// Find available prompts for invoice processing
const prompts = await search_sigagent_prompts("invoice");

// Run extraction with a specific prompt
const extraction = await run_sigagent_extraction(
  documents.documents[0].id, 
  prompts.prompts[0].id
);
```

### 2. Document Discovery Workflow

```typescript
// Get all documents
const allDocuments = await get_sigagent_documents();

// Get all available prompts
const allPrompts = await get_sigagent_prompts();

// Get all tags for categorization
const allTags = await get_sigagent_tags();
```

### 3. Guided Analysis Workflow

```typescript
// Get a step-by-step guide for analyzing a specific document
const guide = await sigagent_document_analysis_guide("document-id");

// Follow the guide to analyze the document
// The guide will provide specific prompts and extraction strategies
```

## Troubleshooting

### Common Issues

#### 1. "MCP server not connecting"

**Solutions:**
- Verify the binary exists: `which sigagent-mcp`
- Check configuration syntax in your `.mcp.json`
- Ensure environment variables are set correctly
- Test the server manually: `sigagent-mcp`

#### 2. "Command not found"

**Solutions:**
- Reinstall globally: `npm install -g @sigagent/mcp`
- Check your PATH: `echo $PATH`
- Use full path in configuration if needed

#### 3. "Environment variables not set"

**Solutions:**
- Verify variable names: `SIGAGENT_ORG_ID`, `SIGAGENT_ORG_API_TOKEN`
- Check variable values are correct and not expired
- Test API access with your credentials

#### 4. "Permission denied"

**Solutions:**
- Don't use `sudo` for MCP servers
- Check file permissions on the binary
- Ensure you have access to the project directory

### Debug Mode

Enable debug logging by adding to your environment:

```json
{
  "mcpServers": {
    "sigagent": {
      "command": "sigagent-mcp",
      "env": {
        "SIGAGENT_API_URL": "https://app.sigagent.ai/fastapi",
        "SIGAGENT_ORG_ID": "your-org-id",
        "SIGAGENT_ORG_API_TOKEN": "your-api-token",
        "DEBUG": "mcp:*"
      }
    }
  }
}
```

### Verification Commands

```bash
# Check package installation
npm list -g @sigagent/mcp

# Check binary location
which sigagent-mcp

# Test server startup
sigagent-mcp --help

# Verify environment variables
echo $SIGAGENT_ORG_ID
echo $SIGAGENT_ORG_API_TOKEN
```

## Security Best Practices

### Credential Management

1. **Never commit credentials** to version control
2. **Use environment variables** instead of hardcoded values
3. **Rotate API tokens** regularly
4. **Limit token permissions** to minimum required access
5. **Add `.mcp.json` to `.gitignore`** if it contains real credentials

### Example Secure Configuration

```bash
# Set environment variables in your shell profile
echo 'export SIGAGENT_ORG_ID="your-org-id"' >> ~/.bashrc
echo 'export SIGAGENT_ORG_API_TOKEN="your-token"' >> ~/.bashrc
source ~/.bashrc
```

Then use environment variables in your configuration:

```json
{
  "mcpServers": {
    "sigagent": {
      "command": "sigagent-mcp",
      "env": {
        "SIGAGENT_ORG_ID": "${SIGAGENT_ORG_ID}",
        "SIGAGENT_ORG_API_TOKEN": "${SIGAGENT_ORG_API_TOKEN}"
      }
    }
  }
}
```

## Advanced Configuration

### Custom API Endpoints

For development or custom deployments:

```json
{
  "mcpServers": {
    "sigagent": {
      "command": "sigagent-mcp",
      "env": {
        "SIGAGENT_API_URL": "http://localhost:8000",
        "SIGAGENT_ORG_ID": "your-org-id",
        "SIGAGENT_ORG_API_TOKEN": "your-token"
      }
    }
  }
}
```

### Multiple Environments

You can configure multiple SigAgent instances:

```json
{
  "mcpServers": {
    "sigagent-prod": {
      "command": "sigagent-mcp",
      "env": {
        "SIGAGENT_API_URL": "https://app.sigagent.ai/fastapi",
        "SIGAGENT_ORG_ID": "prod-org-id",
        "SIGAGENT_ORG_API_TOKEN": "prod-token"
      }
    },
    "sigagent-dev": {
      "command": "sigagent-mcp",
      "env": {
        "SIGAGENT_API_URL": "http://localhost:8000",
        "SIGAGENT_ORG_ID": "dev-org-id",
        "SIGAGENT_ORG_API_TOKEN": "dev-token"
      }
    }
  }
}
```

## Package Information

- **Package Name**: `@sigagent/mcp`
- **Current Version**: 0.1.0
- **Node.js Requirement**: >=18.0.0
- **License**: MIT
- **Repository**: Available on npm registry

### Package Contents

The published package includes:
- Built JavaScript files (CommonJS + ES Modules)
- TypeScript definitions
- Source maps for debugging
- Bundled knowledge base files
- Documentation

## Support and Resources

### Getting Help

1. **Check the troubleshooting section** above
2. **Review the README.md** in the package
3. **Test with debug mode** enabled
4. **Verify your SigAgent API access** independently

### Package Management

```bash
# Update to latest version
npm update -g @sigagent/mcp

# Check current version
npm list -g @sigagent/mcp

# Uninstall if needed
npm uninstall -g @sigagent/mcp
```

### Development

For developers working on the MCP server:

```bash
# Clone the repository
git clone <repository-url>
cd sigagent-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Development mode
npm run dev
```
