# CLAUDE.md

This file provides guidance to Claude Code when using DocRouter MCP tools.

## Working with DocRouter MCP Tools

### CRITICAL: Always Call Help Tools First

Before creating or modifying DocRouter resources, **ALWAYS** follow this workflow:

1. **Call help tools FIRST**:
   - `mcp__docrouter__help_schemas()` - Before creating/modifying schemas
   - `mcp__docrouter__help_prompts()` - Before creating/modifying prompts
   - `mcp__docrouter__help()` - For general API guidance

2. **Validate before creating**:
   - `mcp__docrouter__validate_schema(schema)` - ALWAYS validate schemas before creating them
   - Check the validation response for errors and fix any issues

3. **Then create the resource**:
   - Only after help and validation, create the resource

### Schema Creation Rules

**CRITICAL**: OpenAI's strict mode requires:

- **ALL properties in an object MUST be in the `required` array** (even optional fields)
- Use `additionalProperties: false` for strict validation
- All nested objects must follow the same rules
- Never create a schema without validating it first

**Wrong** (will fail):
```json
{
  "properties": {
    "personal_info": {
      "properties": {
        "name": {"type": "string"},
        "phone": {"type": "string"}
      },
      "required": ["name"]  // ❌ Missing "phone" in required
    }
  }
}
```

**Correct**:
```json
{
  "properties": {
    "personal_info": {
      "properties": {
        "name": {"type": "string"},
        "phone": {"type": "string"}
      },
      "required": ["name", "phone"]  // ✅ ALL properties listed
    }
  }
}
```

### Mandatory Workflow for Schema Creation

```
1. mcp__docrouter__help_schemas()       // Read the documentation
2. mcp__docrouter__validate_schema()    // Validate your schema
3. Fix any validation errors
4. mcp__docrouter__create_schema()      // Only if validation passes
```

### Never Skip Validation

**NEVER** call `create_schema`, `create_prompt`, or `create_form` without:
1. Reading the help documentation first
2. Validating the schema/structure first
3. Confirming validation succeeded

This prevents wasted time and ensures resources are created correctly on the first attempt.
