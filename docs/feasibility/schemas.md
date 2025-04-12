# Schema System Refactoring Feasibility Study

## Overview

This document explores the feasibility of refactoring the schema system to improve naming conventions and introduce a template-based architecture, complementing the prompt template system. The goal is to ensure consistency between prompts and schemas while enhancing reusability.

## Current System

The current implementation has one main collection:
- `schemas`: Contains all schema instances with schema_id and schema_version fields

Issues with the current approach:
- There's no standardized way to define reusable schema templates
- Prompt templates would need to reference schema templates for complete template functionality
- There's no clear separation between schema definitions and schema usage

## Proposed Changes

### 1. Database Schema Refactoring

#### 1.1 Collection Renaming

```
schemas → schema_revisions
schema_versions → schemas
```

This rename better reflects that:
- `schema_revisions` contains the actual content and implementation of each schema version
- `schemas` simply tracks name and latest version number for each schema ID

#### 1.2 Schema Adjustments

Add a simple boolean field to indicate templates:
```json
{
  "is_template": true|false,
}
```

### 2. API Changes

#### 2.1 Endpoint Structure

Maintain backward compatibility with naming while adding template functionality:

```
# Existing endpoints remain unchanged
/v0/orgs/{organization_id}/schemas
/v0/orgs/{organization_id}/schemas/{schema_id}

# New template endpoints
/v0/orgs/{organization_id}/schema_templates
/v0/orgs/{organization_id}/schema_templates/{template_id}
```

#### 2.2 API Specifications

**Template Endpoints:**

```
GET /v0/orgs/{organization_id}/schema_templates
- Lists all available schema templates
- Query params: skip, limit, tag_ids
- Response: ListSchemaTemplatesResponse (same structure as ListSchemasResponse)

GET /v0/orgs/{organization_id}/schema_templates/{template_id}
- Gets a specific schema template with full content
- Response: SchemaTemplate model (same structure as Schema)
```

### 3. Frontend Changes

#### 3.1 UI Components

- Add a `SchemaTemplates.tsx` component for browsing schema templates
- Add template selection in schema creation flow
- Create a "Use Template" button that pre-fills schema creation form
- Update PromptCreate.tsx to handle schema template resolution

#### 3.2 TypeScript Types

Update in `frontend/src/types/schemas.ts`:
```typescript
export interface SchemaConfig {
  name: string;
  response_format: ResponseFormat;
  tag_ids?: string[];
  is_template?: boolean;
}

export interface SchemaTemplateConfig extends SchemaConfig {
  is_template: true;
}

// Add template-specific API interfaces
export interface ListSchemaTemplatesParams {
  organizationId: string;
  skip?: number;
  limit?: number;
  tag_ids?: string;
}

export interface GetSchemaTemplateParams {
  organizationId: string;
  templateId: string;
}
```

### 4. Integration with Prompt Templates

The relationship between prompt templates and schema templates needs special consideration:

1. A prompt template can reference a schema template by ID
2. When a prompt is created from a template:
   - If the template references a schema template, create a new schema from that template
   - If the template references a specific schema, use that schema directly

This allows for maximum flexibility while maintaining the relationships between prompts and schemas.

### 5. Git-Based Templates

Similar to prompt templates, implement system for loading schema templates from Git repository:

```
/templates/schemas/*.json → Stores schema templates as JSON files
```

Schema template JSON format:
```json
{
  "name": "Template Name",
  "response_format": {
    "json_schema": {
      "type": "object",
      "properties": {
        "field1": {"type": "string"},
        "field2": {"type": "number"}
      }
    }
  },
  "tag_ids": ["tag1", "tag2"]
}
```

### 6. Unit Tests

Update existing tests and add new ones:
- Update collection references from `schemas` to `schema_revisions`
- Add tests for schema template listing and retrieval
- Add tests for schema template instantiation
- Add tests for Git-based schema template loading
- Test system vs. user schema template permissions

## Implementation Plan

1. Create database migration for collection renaming
2. Add is_template field
3. Implement template API endpoints
4. Implement Git-based template loading
5. Create template UI components
6. Update docrouter_client
7. Add template unit tests
8. Deploy with backward compatibility

## Risk Assessment

Low-risk changes:
- Collection renaming (done via migration)
- Adding template fields (optional fields)
- Simple CRUD operations for templates

Medium-risk changes:
- Git integration for templates
- Template instantiation logic
- Frontend template selection UI

High-risk changes:
- Integration between prompt templates and schema templates
- Ensuring version compatibility between templates

## Conclusion

This refactoring is feasible with minimal schema changes and complements the prompt template system. By implementing schema templates alongside prompt templates, we create a fully-featured template system that allows for maximum reusability and flexibility.

The integration between prompt templates and schema templates requires careful consideration, but the benefits in terms of improved developer experience and system maintainability outweigh the implementation complexity.
