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

// Define tools - organized by category matching the SDK
const tools: Tool[] = [
  // ========== DOCUMENTS ==========
  {
    name: 'uploadDocuments',
    description: 'Upload documents to DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          description: 'Array of documents to upload',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Document name' },
              content: { type: 'string', description: 'Base64 encoded document content' },
              type: { type: 'string', description: 'Document type (pdf, image, etc.)' },
              metadata: { type: 'object', description: 'Optional metadata' },
            },
            required: ['name', 'content', 'type'],
          },
        },
      },
      required: ['documents'],
    },
  },
  {
    name: 'listDocuments',
    description: 'List documents from DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of documents to skip', default: 0 },
        limit: { type: 'number', description: 'Number of documents to return', default: 10 },
        tagIds: { type: 'string', description: 'Comma-separated list of tag IDs to filter by' },
        nameSearch: { type: 'string', description: 'Search by document name' },
        metadataSearch: { type: 'string', description: 'Search by metadata' },
      },
    },
  },
  {
    name: 'getDocument',
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
    name: 'updateDocument',
    description: 'Update document metadata',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document to update' },
        documentName: { type: 'string', description: 'New document name' },
        tagIds: { type: 'array', items: { type: 'string' }, description: 'Array of tag IDs' },
        metadata: { type: 'object', description: 'Document metadata' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'deleteDocument',
    description: 'Delete a document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document to delete' },
      },
      required: ['documentId'],
    },
  },

  // ========== OCR ==========
  {
    name: 'getOCRBlocks',
    description: 'Get OCR blocks for a document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'getOCRText',
    description: 'Get OCR text for a document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        pageNum: { type: 'number', description: 'Optional page number' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'getOCRMetadata',
    description: 'Get OCR metadata for a document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
      },
      required: ['documentId'],
    },
  },

  // ========== LLM ==========
  {
    name: 'runLLM',
    description: 'Run AI extraction on a document using a specific prompt',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        promptRevId: { type: 'string', description: 'ID of the prompt' },
        force: { type: 'boolean', description: 'Force re-extraction', default: false },
      },
      required: ['documentId', 'promptRevId'],
    },
  },
  {
    name: 'getLLMResult',
    description: 'Get LLM extraction results',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        promptRevId: { type: 'string', description: 'ID of the prompt' },
        fallback: { type: 'boolean', description: 'Use fallback results', default: false },
      },
      required: ['documentId', 'promptRevId'],
    },
  },
  {
    name: 'updateLLMResult',
    description: 'Update LLM extraction results',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        promptId: { type: 'string', description: 'ID of the prompt' },
        result: { type: 'object', description: 'Updated result data' },
        isVerified: { type: 'boolean', description: 'Whether result is verified', default: false },
      },
      required: ['documentId', 'promptId', 'result'],
    },
  },
  {
    name: 'deleteLLMResult',
    description: 'Delete LLM extraction results',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        promptId: { type: 'string', description: 'ID of the prompt' },
      },
      required: ['documentId', 'promptId'],
    },
  },

  // ========== TAGS ==========
  {
    name: 'createTag',
    description: 'Create a new tag',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tag name' },
            color: { type: 'string', description: 'Tag color' },
          },
          required: ['name', 'color'],
        },
      },
      required: ['tag'],
    },
  },
  {
    name: 'getTag',
    description: 'Get tag by ID',
    inputSchema: {
      type: 'object',
      properties: {
        tagId: { type: 'string', description: 'ID of the tag' },
      },
      required: ['tagId'],
    },
  },
  {
    name: 'listTags',
    description: 'List all tags',
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
    name: 'updateTag',
    description: 'Update a tag',
    inputSchema: {
      type: 'object',
      properties: {
        tagId: { type: 'string', description: 'ID of the tag' },
        tag: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tag name' },
            color: { type: 'string', description: 'Tag color' },
          },
        },
      },
      required: ['tagId', 'tag'],
    },
  },
  {
    name: 'deleteTag',
    description: 'Delete a tag',
    inputSchema: {
      type: 'object',
      properties: {
        tagId: { type: 'string', description: 'ID of the tag' },
      },
      required: ['tagId'],
    },
  },

  // ========== FORMS ==========
  {
    name: 'createForm',
    description: 'Create a new form',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Form name' },
        response_format: { type: 'object', description: 'Form response format' },
      },
      required: ['name', 'response_format'],
    },
  },
  {
    name: 'listForms',
    description: 'List all forms',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of forms to skip', default: 0 },
        limit: { type: 'number', description: 'Number of forms to return', default: 10 },
        tag_ids: { type: 'string', description: 'Comma-separated tag IDs' },
      },
    },
  },
  {
    name: 'getForm',
    description: 'Get form by ID',
    inputSchema: {
      type: 'object',
      properties: {
        formRevId: { type: 'string', description: 'ID of the form' },
      },
      required: ['formRevId'],
    },
  },
  {
    name: 'updateForm',
    description: 'Update a form',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'ID of the form' },
        form: { type: 'object', description: 'Form data' },
      },
      required: ['formId', 'form'],
    },
  },
  {
    name: 'deleteForm',
    description: 'Delete a form',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'ID of the form' },
      },
      required: ['formId'],
    },
  },
  {
    name: 'submitForm',
    description: 'Submit a form',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        formRevId: { type: 'string', description: 'ID of the form' },
        submission_data: { type: 'object', description: 'Form submission data' },
        submitted_by: { type: 'string', description: 'User who submitted' },
      },
      required: ['documentId', 'formRevId', 'submission_data'],
    },
  },
  {
    name: 'getFormSubmission',
    description: 'Get form submission',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        formRevId: { type: 'string', description: 'ID of the form' },
      },
      required: ['documentId', 'formRevId'],
    },
  },
  {
    name: 'deleteFormSubmission',
    description: 'Delete form submission',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        formRevId: { type: 'string', description: 'ID of the form' },
      },
      required: ['documentId', 'formRevId'],
    },
  },

  // ========== PROMPTS ==========
  {
    name: 'createPrompt',
    description: 'Create a new prompt',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Prompt name' },
            content: { type: 'string', description: 'Prompt content' },
          },
          required: ['name', 'content'],
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'listPrompts',
    description: 'List all prompts',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of prompts to skip', default: 0 },
        limit: { type: 'number', description: 'Number of prompts to return', default: 10 },
        document_id: { type: 'string', description: 'Filter by document ID' },
        tag_ids: { type: 'string', description: 'Comma-separated tag IDs' },
        nameSearch: { type: 'string', description: 'Search by prompt name' },
      },
    },
  },
  {
    name: 'getPrompt',
    description: 'Get prompt by ID',
    inputSchema: {
      type: 'object',
      properties: {
        promptRevId: { type: 'string', description: 'ID of the prompt' },
      },
      required: ['promptRevId'],
    },
  },
  {
    name: 'updatePrompt',
    description: 'Update a prompt',
    inputSchema: {
      type: 'object',
      properties: {
        promptId: { type: 'string', description: 'ID of the prompt' },
        prompt: { type: 'object', description: 'Prompt data' },
      },
      required: ['promptId', 'prompt'],
    },
  },
  {
    name: 'deletePrompt',
    description: 'Delete a prompt',
    inputSchema: {
      type: 'object',
      properties: {
        promptId: { type: 'string', description: 'ID of the prompt' },
      },
      required: ['promptId'],
    },
  },

  // ========== SCHEMAS ==========
  {
    name: 'createSchema',
    description: 'Create a new schema',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Schema name' },
        response_format: { type: 'object', description: 'Schema response format' },
      },
      required: ['name', 'response_format'],
    },
  },
  {
    name: 'listSchemas',
    description: 'List all schemas',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of schemas to skip', default: 0 },
        limit: { type: 'number', description: 'Number of schemas to return', default: 10 },
        nameSearch: { type: 'string', description: 'Search by schema name' },
      },
    },
  },
  {
    name: 'getSchema',
    description: 'Get schema by ID',
    inputSchema: {
      type: 'object',
      properties: {
        schemaRevId: { type: 'string', description: 'ID of the schema' },
      },
      required: ['schemaRevId'],
    },
  },
  {
    name: 'updateSchema',
    description: 'Update a schema',
    inputSchema: {
      type: 'object',
      properties: {
        schemaId: { type: 'string', description: 'ID of the schema' },
        schema: { type: 'object', description: 'Schema data' },
      },
      required: ['schemaId', 'schema'],
    },
  },
  {
    name: 'deleteSchema',
    description: 'Delete a schema',
    inputSchema: {
      type: 'object',
      properties: {
        schemaId: { type: 'string', description: 'ID of the schema' },
      },
      required: ['schemaId'],
    },
  },
  {
    name: 'validateAgainstSchema',
    description: 'Validate data against a schema',
    inputSchema: {
      type: 'object',
      properties: {
        schemaRevId: { type: 'string', description: 'ID of the schema' },
        data: { type: 'object', description: 'Data to validate' },
      },
      required: ['schemaRevId', 'data'],
    },
  },



  // ========== LLM CHAT ==========
  {
    name: 'runLLMChat',
    description: 'Run LLM chat',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          description: 'Chat messages',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        },
        model: { type: 'string', description: 'Model to use' },
        temperature: { type: 'number', description: 'Temperature setting' },
        max_tokens: { type: 'number', description: 'Maximum tokens' },
        stream: { type: 'boolean', description: 'Enable streaming' },
      },
      required: ['messages'],
    },
  },

  // ========== HELPER TOOLS ==========
  {
    name: 'help',
    description: 'Get help information about using the API',
    inputSchema: {
      type: 'object',
      properties: {},
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
      case 'listDocuments': {
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

      case 'getDocument': {
        const result = await docrouterClient.getDocument({
          documentId: getArg(args, 'documentId'),
          fileType: getArg(args, 'fileType', 'pdf'),
        });
        
        // Convert ArrayBuffer to base64 for transmission
        const base64Content = Buffer.from(result.content).toString('base64');
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ...serializeDates(result),
                content: base64Content,
                content_type: 'base64',
                content_size: result.content.byteLength
              }, null, 2),
            },
          ],
        };
      }

      case 'getOCRText': {
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

      case 'getOCRMetadata': {
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

      case 'listTags': {
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

      case 'getTag': {
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

      case 'listPrompts': {
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

      case 'getPrompt': {
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

      case 'getLLMResult': {
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


      case 'runLLM': {
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

      // ========== DOCUMENTS ==========
      case 'uploadDocuments': {
        const documentsInput = getArg(args, 'documents') as Array<{ name: string; content: string; type: string; metadata?: Record<string, string>; }>;
        const documents = documentsInput.map(doc => ({
          ...doc,
          content: Buffer.from(doc.content, 'base64')
        }));
        const result = await docrouterClient.uploadDocuments({ documents });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'updateDocument': {
        const result = await docrouterClient.updateDocument({
          documentId: getArg(args, 'documentId'),
          documentName: getOptionalArg(args, 'documentName'),
          tagIds: getOptionalArg(args, 'tagIds'),
          metadata: getOptionalArg(args, 'metadata'),
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

      case 'deleteDocument': {
        const result = await docrouterClient.deleteDocument({
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

      // ========== OCR ==========
      case 'getOCRBlocks': {
        const result = await docrouterClient.getOCRBlocks({
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

      // ========== LLM ==========
      case 'updateLLMResult': {
        const result = await docrouterClient.updateLLMResult({
          documentId: getArg(args, 'documentId'),
          promptId: getArg(args, 'promptId'),
          result: getArg(args, 'result'),
          isVerified: getOptionalArg(args, 'isVerified', false),
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

      case 'deleteLLMResult': {
        const result = await docrouterClient.deleteLLMResult({
          documentId: getArg(args, 'documentId'),
          promptId: getArg(args, 'promptId'),
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


      // ========== TAGS ==========
      case 'createTag': {
        const result = await docrouterClient.createTag({
          tag: getArg(args, 'tag'),
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

      case 'updateTag': {
        const result = await docrouterClient.updateTag({
          tagId: getArg(args, 'tagId'),
          tag: getArg(args, 'tag'),
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

      case 'deleteTag': {
        const result = await docrouterClient.deleteTag({
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

      // ========== FORMS ==========
      case 'createForm': {
        const result = await docrouterClient.createForm({
          name: getArg(args, 'name'),
          response_format: getArg(args, 'response_format'),
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

      case 'listForms': {
        const result = await docrouterClient.listForms({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          tag_ids: getOptionalArg(args, 'tag_ids'),
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

      case 'getForm': {
        const result = await docrouterClient.getForm({
          formRevId: getArg(args, 'formRevId'),
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

      case 'updateForm': {
        const result = await docrouterClient.updateForm({
          formId: getArg(args, 'formId'),
          form: getArg(args, 'form'),
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

      case 'deleteForm': {
        const result = await docrouterClient.deleteForm({
          formId: getArg(args, 'formId'),
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

      case 'submitForm': {
        const result = await docrouterClient.submitForm({
          documentId: getArg(args, 'documentId'),
          formRevId: getArg(args, 'formRevId'),
          submission_data: getArg(args, 'submission_data'),
          submitted_by: getOptionalArg(args, 'submitted_by'),
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

      case 'getFormSubmission': {
        const result = await docrouterClient.getFormSubmission({
          documentId: getArg(args, 'documentId'),
          formRevId: getArg(args, 'formRevId'),
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

      case 'deleteFormSubmission': {
        const result = await docrouterClient.deleteFormSubmission({
          documentId: getArg(args, 'documentId'),
          formRevId: getArg(args, 'formRevId'),
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

      // ========== PROMPTS ==========
      case 'createPrompt': {
        const result = await docrouterClient.createPrompt({
          prompt: getArg(args, 'prompt'),
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

      case 'updatePrompt': {
        const result = await docrouterClient.updatePrompt({
          promptId: getArg(args, 'promptId'),
          prompt: getArg(args, 'prompt'),
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

      case 'deletePrompt': {
        const result = await docrouterClient.deletePrompt({
          promptId: getArg(args, 'promptId'),
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

      // ========== SCHEMAS ==========
      case 'createSchema': {
        const result = await docrouterClient.createSchema({
          name: getArg(args, 'name'),
          response_format: getArg(args, 'response_format'),
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

      case 'listSchemas': {
        const result = await docrouterClient.listSchemas({
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

      case 'getSchema': {
        const result = await docrouterClient.getSchema({
          schemaRevId: getArg(args, 'schemaRevId'),
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

      case 'updateSchema': {
        const result = await docrouterClient.updateSchema({
          schemaId: getArg(args, 'schemaId'),
          schema: getArg(args, 'schema'),
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

      case 'deleteSchema': {
        const result = await docrouterClient.deleteSchema({
          schemaId: getArg(args, 'schemaId'),
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

      case 'validateAgainstSchema': {
        const result = await docrouterClient.validateAgainstSchema({
          schemaRevId: getArg(args, 'schemaRevId'),
          data: getArg(args, 'data'),
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



      // ========== LLM CHAT ==========
      case 'runLLMChat': {
        const result = await docrouterClient.runLLMChat({
          messages: getArg(args, 'messages'),
          model: getOptionalArg(args, 'model'),
          temperature: getOptionalArg(args, 'temperature'),
          max_tokens: getOptionalArg(args, 'max_tokens'),
          stream: getOptionalArg(args, 'stream'),
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

      // ========== HELPER TOOLS ==========
      case 'help': {
        const helpText = `
# DocRouter API Help

This server provides access to DocRouter resources and tools.

## Available Tools

### Documents
- \`uploadDocuments(documents)\` - Upload documents
- \`listDocuments(skip, limit, tagIds, nameSearch, metadataSearch)\` - List documents
- \`getDocument(documentId, fileType)\` - Get document by ID
- \`updateDocument(documentId, documentName, tagIds, metadata)\` - Update document
- \`deleteDocument(documentId)\` - Delete document

### OCR
- \`getOCRBlocks(documentId)\` - Get OCR blocks
- \`getOCRText(documentId, pageNum)\` - Get OCR text
- \`getOCRMetadata(documentId)\` - Get OCR metadata

### LLM
- \`runLLM(documentId, promptRevId, force)\` - Run AI extraction
- \`getLLMResult(documentId, promptRevId, fallback)\` - Get extraction results
- \`updateLLMResult(documentId, promptId, result, isVerified)\` - Update results
- \`deleteLLMResult(documentId, promptId)\` - Delete results

### Tags
- \`createTag(tag)\` - Create tag
- \`getTag(tagId)\` - Get tag by ID
- \`listTags(skip, limit, nameSearch)\` - List tags
- \`updateTag(tagId, tag)\` - Update tag
- \`deleteTag(tagId)\` - Delete tag

### Forms
- \`createForm(name, response_format)\` - Create form
- \`listForms(skip, limit, tag_ids)\` - List forms
- \`getForm(formRevId)\` - Get form by ID
- \`updateForm(formId, form)\` - Update form
- \`deleteForm(formId)\` - Delete form
- \`submitForm(documentId, formRevId, submission_data, submitted_by)\` - Submit form
- \`getFormSubmission(documentId, formRevId)\` - Get form submission
- \`deleteFormSubmission(documentId, formRevId)\` - Delete form submission

### Prompts
- \`createPrompt(prompt)\` - Create prompt
- \`listPrompts(skip, limit, document_id, tag_ids, nameSearch)\` - List prompts
- \`getPrompt(promptRevId)\` - Get prompt by ID
- \`updatePrompt(promptId, prompt)\` - Update prompt
- \`deletePrompt(promptId)\` - Delete prompt

### Schemas
- \`createSchema(name, response_format)\` - Create schema
- \`listSchemas(skip, limit, nameSearch)\` - List schemas
- \`getSchema(schemaRevId)\` - Get schema by ID
- \`updateSchema(schemaId, schema)\` - Update schema
- \`deleteSchema(schemaId)\` - Delete schema
- \`validateAgainstSchema(schemaRevId, data)\` - Validate data


### LLM Chat
- \`runLLMChat(messages, model, temperature, max_tokens, stream)\` - Run chat

## Example Workflows

1. List documents:
   \`\`\`
   listDocuments()
   \`\`\`

2. Get OCR text for a document:
   \`\`\`
   getOCRText("doc123")
   \`\`\`

3. Run AI extraction:
   \`\`\`
   runLLM("doc123", "prompt456")
   \`\`\`

4. Get extraction results:
   \`\`\`
   getLLMResult("doc123", "prompt456")
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

