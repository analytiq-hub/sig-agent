#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DocRouterOrg } from 'docrouter-sdk';

// Configuration schema
const ConfigSchema = z.object({
  baseURL: z.string().default('https://app.docrouter.ai/fastapi'),
  organizationId: z.string(),
  orgToken: z.string(),
  timeout: z.number().default(30000),
  retries: z.number().default(3),
});

type Config = z.infer<typeof ConfigSchema>;

// Parse command line arguments and environment variables
function parseConfig(): Config {
  const args = process.argv.slice(2);
  const config: Partial<Config> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    if (key && value) {
      switch (key) {
        case 'url':
          config.baseURL = value;
          break;
        case 'org-id':
          config.organizationId = value;
          break;
        case 'org-token':
          config.orgToken = value;
          break;
        case 'timeout':
          config.timeout = parseInt(value, 10);
          break;
        case 'retries':
          config.retries = parseInt(value, 10);
          break;
      }
    }
  }

  // Fall back to environment variables
  config.baseURL = config.baseURL || process.env.DOCROUTER_API_URL || 'https://app.docrouter.ai/fastapi';
  config.organizationId = config.organizationId || process.env.DOCROUTER_ORG_ID || '';
  config.orgToken = config.orgToken || process.env.DOCROUTER_ORG_API_TOKEN || '';

  return ConfigSchema.parse(config);
}

// Create the MCP server
const server = new Server(
  {
    name: 'docrouter-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Global DocRouter client
let docrouterClient: DocRouterOrg;

// Initialize DocRouter client
function initializeClient(config: Config) {
  docrouterClient = new DocRouterOrg({
    baseURL: config.baseURL,
    orgToken: config.orgToken,
    organizationId: config.organizationId,
    timeout: config.timeout,
    retries: config.retries,
  });
}

// Helper function to handle errors
function handleError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({ error: error.message }, null, 2);
  }
  return JSON.stringify({ error: 'Unknown error occurred' }, null, 2);
}

// Helper function to serialize dates
function serializeDates(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeDates);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDates(value);
    }
    return result;
  }
  
  return obj;
}

// Helper function to safely get typed arguments
function getArg<T>(args: Record<string, unknown>, key: string, defaultValue?: T): T {
  const value = args[key];
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required argument: ${key}`);
  }
  return value as T;
}

function getOptionalArg<T>(args: Record<string, unknown>, key: string, defaultValue?: T): T | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value as T;
}

// Define tools
const tools: Tool[] = [
  {
    name: 'get_docrouter_documents',
    description: 'Get all documents from DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of documents to skip', default: 0 },
        limit: { type: 'number', description: 'Number of documents to return', default: 10 },
        nameSearch: { type: 'string', description: 'Search by document name' },
        tagIds: { type: 'string', description: 'Comma-separated list of tag IDs to filter by' },
      },
    },
  },
  {
    name: 'get_docrouter_document',
    description: 'Get document by ID from DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document to retrieve' },
        fileType: { type: 'string', description: 'File type to retrieve (pdf, image, etc.)', default: 'pdf' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'get_docrouter_document_ocr',
    description: 'Get the raw OCR text for a document from DocRouter. Use this to see the document content.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document to get OCR text for' },
        pageNum: { type: 'number', description: 'Optional page number to get OCR text for' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'get_docrouter_document_ocr_metadata',
    description: 'Get OCR metadata for a document from DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document to get OCR metadata for' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'get_docrouter_tags',
    description: 'Get all tags from DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of tags to skip', default: 0 },
        limit: { type: 'number', description: 'Number of tags to return', default: 10 },
        nameSearch: { type: 'string', description: 'Search by tag name' },
      },
    },
  },
  {
    name: 'get_docrouter_tag',
    description: 'Get tag by ID from DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        tagId: { type: 'string', description: 'ID of the tag to retrieve' },
      },
      required: ['tagId'],
    },
  },
  {
    name: 'get_docrouter_prompts',
    description: 'Get all prompts from DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of prompts to skip', default: 0 },
        limit: { type: 'number', description: 'Number of prompts to return', default: 10 },
        nameSearch: { type: 'string', description: 'Search by prompt name' },
        documentId: { type: 'string', description: 'Filter prompts by document ID' },
        tagIds: { type: 'string', description: 'Comma-separated list of tag IDs to filter by' },
      },
    },
  },
  {
    name: 'get_docrouter_prompt',
    description: 'Get prompt by ID from DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        promptRevId: { type: 'string', description: 'ID of the prompt to retrieve' },
      },
      required: ['promptRevId'],
    },
  },
  {
    name: 'get_docrouter_extraction',
    description: 'Get extraction results for a document using a specific prompt',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        promptRevId: { type: 'string', description: 'ID of the prompt' },
        fallback: { type: 'boolean', description: 'Whether to use fallback results', default: false },
      },
      required: ['documentId', 'promptRevId'],
    },
  },
  {
    name: 'search_docrouter_documents',
    description: 'Search documents by name or content',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        tagIds: { type: 'string', description: 'Comma-separated list of tag IDs to filter by' },
        skip: { type: 'number', description: 'Number of documents to skip', default: 0 },
        limit: { type: 'number', description: 'Number of documents to return', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_docrouter_prompts',
    description: 'Search prompts by name or content',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        skip: { type: 'number', description: 'Number of prompts to skip', default: 0 },
        limit: { type: 'number', description: 'Number of prompts to return', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_docrouter_tags',
    description: 'Search tags by name or description',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        skip: { type: 'number', description: 'Number of tags to skip', default: 0 },
        limit: { type: 'number', description: 'Number of tags to return', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'run_docrouter_extraction',
    description: 'Run AI extraction on a document using a specific prompt. Use this when you need to extract structured data from a document.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document to extract from' },
        promptRevId: { type: 'string', description: 'ID of the prompt to use for extraction' },
        force: { type: 'boolean', description: 'Whether to force re-extraction even if results already exist', default: false },
      },
      required: ['documentId', 'promptRevId'],
    },
  },
  {
    name: 'docrouter_help',
    description: 'Get help information about using the DocRouter API',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'docrouter_document_analysis_guide',
    description: 'Generate a guide to analyze a specific document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document to analyze' },
      },
      required: ['documentId'],
    },
  },
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args) {
    throw new Error('No arguments provided');
  }

  try {
    switch (name) {
      case 'get_docrouter_documents': {
        const result = await docrouterClient.listDocuments({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          nameSearch: getOptionalArg(args, 'nameSearch'),
          tagIds: getOptionalArg(args, 'tagIds'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_docrouter_document': {
        const result = await docrouterClient.getDocument({
          documentId: getArg(args, 'documentId'),
          fileType: getArg(args, 'fileType', 'pdf'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_docrouter_document_ocr': {
        const result = await docrouterClient.getOCRText({
          documentId: getArg(args, 'documentId'),
          pageNum: getOptionalArg(args, 'pageNum'),
        });
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'get_docrouter_document_ocr_metadata': {
        const result = await docrouterClient.getOCRMetadata({
          documentId: getArg(args, 'documentId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_docrouter_tags': {
        const result = await docrouterClient.listTags({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          nameSearch: getOptionalArg(args, 'nameSearch'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_docrouter_tag': {
        const result = await docrouterClient.getTag({
          tagId: getArg(args, 'tagId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_docrouter_prompts': {
        const result = await docrouterClient.listPrompts({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          nameSearch: getOptionalArg(args, 'nameSearch'),
          document_id: getOptionalArg(args, 'documentId'),
          tag_ids: getOptionalArg(args, 'tagIds'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_docrouter_prompt': {
        const result = await docrouterClient.getPrompt({
          promptRevId: getArg(args, 'promptRevId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_docrouter_extraction': {
        const result = await docrouterClient.getLLMResult({
          documentId: getArg(args, 'documentId'),
          promptRevId: getArg(args, 'promptRevId'),
          fallback: getOptionalArg(args, 'fallback', false),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'search_docrouter_documents': {
        const result = await docrouterClient.listDocuments({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          nameSearch: getArg(args, 'query'),
          tagIds: getOptionalArg(args, 'tagIds'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'search_docrouter_prompts': {
        const result = await docrouterClient.listPrompts({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          nameSearch: getArg(args, 'query'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'search_docrouter_tags': {
        const result = await docrouterClient.listTags({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          nameSearch: getArg(args, 'query'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'run_docrouter_extraction': {
        const result = await docrouterClient.runLLM({
          documentId: getArg(args, 'documentId'),
          promptRevId: getArg(args, 'promptRevId'),
          force: getOptionalArg(args, 'force', false),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'docrouter_help': {
        const helpText = `
# DocRouter API Help

This server provides access to DocRouter resources and tools.

## Available Tools

### Document Tools
- \`get_docrouter_documents()\` - List all documents
- \`get_docrouter_document(documentId)\` - Get document by ID
- \`get_docrouter_document_ocr(documentId)\` - Get raw OCR text for a document (use this to see document content)
- \`get_docrouter_document_ocr_metadata(documentId)\` - Get OCR metadata for a document
- \`get_docrouter_extraction(documentId, promptRevId)\` - Get extraction results

### Tag Tools
- \`get_docrouter_tags()\` - List all tags
- \`get_docrouter_tag(tagId)\` - Get tag by ID

### Prompt Tools
- \`get_docrouter_prompts()\` - List all prompts
- \`get_docrouter_prompt(promptRevId)\` - Get prompt by ID

### Search and Extraction Tools
- \`search_docrouter_documents(query, tagIds)\` - Search documents by name
- \`search_docrouter_prompts(query)\` - Search prompts by name or content
- \`search_docrouter_tags(query)\` - Search tags by name or description
- \`run_docrouter_extraction(documentId, promptRevId, force)\` - Run AI extraction on a document using a specific prompt

## Example Workflows

1. Find documents related to invoices:
   \`\`\`
   search_docrouter_documents("invoice")
   \`\`\`

2. Get OCR text for a document (to see the document content):
   \`\`\`
   get_docrouter_document_ocr("doc123")
   \`\`\`

3. Run AI extraction on a document (requires a prompt):
   \`\`\`
   run_docrouter_extraction("doc123", "prompt456")
   \`\`\`

4. View extraction results:
   \`\`\`
   get_docrouter_extraction("doc123", "prompt456")
   \`\`\`
        `;
        return {
          content: [
            {
              type: 'text',
              text: helpText,
            },
          ],
        };
      }

      case 'docrouter_document_analysis_guide': {
        const documentId = getArg(args, 'documentId');
        const guideText = `
# Document Analysis Guide for Document ${documentId}

Here's a step-by-step guide to analyze this document:

## 1. Get Document Details
First, get the document details:
\`\`\`
get_docrouter_document("${documentId}")
\`\`\`

## 2. View Document Content
Get the OCR text to see the document content:
\`\`\`
get_docrouter_document_ocr("${documentId}")
\`\`\`

## 3. Find Available Prompts
See what prompts are available:
\`\`\`
get_docrouter_prompts()
\`\`\`

## 4. Select an Appropriate Prompt
Based on the document content, select a prompt that would be most appropriate.
Let's say you choose a prompt with ID "prompt_id".

## 5. Run Extraction
Run an extraction with the selected prompt:
\`\`\`
run_docrouter_extraction("${documentId}", "prompt_id")
\`\`\`

## 6. View Results
View the extraction results:
\`\`\`
get_docrouter_extraction("${documentId}", "prompt_id")
\`\`\`

## 7. Analyze Results
Analyze the extracted information to understand the key details in this document.
        `;
        return {
          content: [
            {
              type: 'text',
              text: guideText,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: handleError(error),
        },
      ],
      isError: true,
    };
  }
});

// Main function
async function main() {
  try {
    const config = parseConfig();
    
    if (!config.organizationId || !config.orgToken) {
      console.error('Error: DOCROUTER_ORG_ID and DOCROUTER_ORG_API_TOKEN environment variables are required');
      console.error('Or provide them as command line arguments: --org-id <id> --org-token <token>');
      process.exit(1);
    }

    initializeClient(config);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('DocRouter MCP server started successfully');
  } catch (error) {
    console.error('Failed to start DocRouter MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down DocRouter MCP server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down DocRouter MCP server...');
  process.exit(0);
});

// Start the server
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
