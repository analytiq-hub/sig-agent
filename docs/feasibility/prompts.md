# Prompt System Refactoring Feasibility Study

## Overview

This document explores the feasibility of refactoring the prompt system to improve naming conventions and introduce a template-based architecture. The goal is to minimize schema changes while enhancing the system's extensibility and understandability.

## Current System

The current implementation has two main collections:
- `prompts`: Contains all prompt instances with a version field
- `prompt_versions`: Tracks the latest version number for each prompt

Issues with the current approach:
- The naming is confusing as `prompts` contains versions while `prompt_versions` tracks IDs
- There's no standardized way to define reusable prompt templates
- The versioning system lacks clarity in terms of its entity relationships

## Proposed Changes

### 1. Database Schema Refactoring

#### 1.1 Collection Renaming

```
prompts → prompt_definitions
prompt_versions → prompt_version_counters
```

This rename better reflects that:
- `prompt_definitions` contains the actual content and implementation of each prompt version
- `prompt_version_counters` simply tracks version numbers for each prompt ID

#### 1.2 Schema Adjustments

Add a new boolean field to support templates:
```json
{
  "is_template": true|false,
  "template_id": "optional_id_of_parent_template"
}
```

### 2. API Changes

Update all API endpoints to reflect the new naming conventions:

```
/v0/orgs/{organization_id}/prompts → no change (maintains backward compatibility)
/v0/orgs/{organization_id}/prompt_templates → new endpoint for templates
```

API changes will be minimal, focusing on:
- Adding template-related query parameters to existing endpoints
- Creating new endpoints for template management
- Maintaining backward compatibility in function names and parameters

### 3. Frontend Changes

#### 3.1 UI Components

- Update `Prompts.tsx` to add template filtering options
- Create a new `PromptTemplates.tsx` component for template management
- Add template selection UI when creating new prompts

#### 3.2 TypeScript Types

Update in `frontend/src/types/prompts.ts`:
```typescript
export interface PromptConfig {
  name: string;
  content: string;
  schema_id?: string;
  schema_version?: number;
  tag_ids?: string[];
  model?: string;
  is_template?: boolean;
  template_id?: string;
}
```

### 4. docrouter_client Changes

Update client library in `backend/docrouter_client/`:

```python
# Update models in backend/docrouter_client/models/prompt.py
class PromptConfig(BaseModel):
    name: str
    content: str
    schema_id: Optional[str] = None
    schema_version: Optional[int] = None
    tag_ids: List[str] = []
    model: str = "gpt-4o-mini"
    is_template: bool = False
    template_id: Optional[str] = None

# Add template methods to backend/docrouter_client/api/prompts.py
def list_templates(self, organization_id: str, ...) -> ListPromptsResponse:
    """List prompt templates"""
    ...

def instantiate_from_template(self, organization_id: str, template_id: str, ...) -> Prompt:
    """Create a prompt from a template"""
    ...
```

### 5. Git-Based Templates

Implement system for loading templates from Git repository:

```
/templates/prompts/*.json → Stores templates as JSON files
```

Add startup code in `lifespan` function to load templates:
```python
async def lifespan(app):
    # Existing startup code
    
    # Load prompt templates from Git
    await load_templates_from_git(db)
    
    yield
    
    # Existing shutdown code
```

### 6. Unit Tests

Update existing tests in `backend/tests/test_prompts.py`:
- Rename references to prompt collections
- Add tests for template functionality
- Add tests for Git-based template loading

## Implementation Plan

1. Create database migration for collection renaming
2. Update models and database access code
3. Add template functionality
4. Implement Git-based template loading
5. Update frontend components
6. Update docrouter_client
7. Update unit tests
8. Deploy with backward compatibility

## Risk Assessment

Low-risk changes:
- Collection renaming (done via migration)
- Adding template fields (optional fields)

Medium-risk changes:
- Git integration for templates
- Frontend UI changes

## Conclusion

This refactoring is feasible with minimal schema changes. The primary changes involve:
1. Renaming collections to better reflect their purpose
2. Adding template functionality through optional fields
3. Implementing Git-based template storage

The changes maintain backward compatibility while improving the system's extensibility and clarity.