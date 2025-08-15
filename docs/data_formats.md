# Data Format Comparison: n8n vs FormIO

This document compares how n8n and FormIO store schemas and data, examining their different approaches to workflow automation versus form building.

## n8n: Workflow Automation Platform

n8n is a workflow automation platform that connects various services and transforms data between them. It stores both workflow definitions (schemas) and runtime data in specific JSON formats.

### n8n Workflow Schema Structure

n8n workflows are stored as JSON objects containing three main components:

1. **Node Definitions** - What each step does
2. **Connections** - How data flows between steps  
3. **Visual Layout** - Where nodes appear on the canvas

#### Basic Workflow Schema Example

```json
{
  "meta": {
    "instanceId": "workflow_instance_id"
  },
  "nodes": [
    {
      "parameters": {
        "httpMethod": "GET",
        "url": "https://api.example.com/users",
        "options": {}
      },
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 1,
      "position": [250, 300],
      "id": "node-id-1"
    },
    {
      "parameters": {
        "keepOnlySet": true,
        "values": {
          "string": [
            {
              "name": "full_name",
              "value": "={{ $json.first_name + ' ' + $json.last_name }}"
            }
          ],
          "number": [
            {
              "name": "age",
              "value": "={{ Math.floor((Date.now() - new Date($json.birth_date)) / 31557600000) }}"
            }
          ]
        }
      },
      "name": "Transform Data",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3,
      "position": [450, 300],
      "id": "node-id-2"
    }
  ],
  "connections": {
    "HTTP Request": {
      "main": [
        [
          {
            "node": "Transform Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}
```

#### Key Schema Components

- **nodes[]**: Array of workflow steps, each with:
  - `type`: Node type (HTTP request, data transformation, etc.)
  - `parameters`: Configuration for the node
  - `position`: X,Y coordinates for visual layout
  - `id`: Unique identifier

- **connections**: Object defining data flow between nodes
  - Maps source node names to target nodes
  - Specifies connection type and index

- **Expressions**: Data transformations using `{{ }}` syntax
  - JavaScript expressions for complex logic
  - Built-in variables like `$json`, `$node["NodeName"]`

### n8n Runtime Data Format

n8n uses a standardized data format for all information flowing between nodes:

```json
[
  {
    "json": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "birth_date": "1985-03-15"
    },
    "binary": {}
  },
  {
    "json": {
      "first_name": "Jane", 
      "last_name": "Smith",
      "email": "jane@example.com",
      "birth_date": "1990-07-22"
    },
    "binary": {}
  }
]
```

#### Data Format Characteristics

- **Array Structure**: Always an array, even for single items
- **Typed Wrappers**: 
  - `json`: Structured data (objects, arrays, primitives)
  - `binary`: File data with metadata
- **Consistent Shape**: Every item has the same structure regardless of content

#### Binary Data Example

```json
[
  {
    "json": {
      "filename": "document.pdf",
      "processing_status": "completed"
    },
    "binary": {
      "document": {
        "data": "base64_encoded_pdf_data...",
        "mimeType": "application/pdf",
        "fileExtension": "pdf", 
        "fileName": "document.pdf"
      }
    }
  }
]
```

### n8n Data Transformation Patterns

#### Expression-Based Transformations
```json
{
  "parameters": {
    "values": {
      "string": [
        {
          "name": "full_address",
          "value": "={{ $json.street + ', ' + $json.city + ', ' + $json.state }}"
        }
      ],
      "boolean": [
        {
          "name": "is_adult",
          "value": "={{ new Date().getFullYear() - new Date($json.birth_date).getFullYear() >= 18 }}"
        }
      ]
    }
  }
}
```

#### Code Block Transformations
```json
{
  "parameters": {
    "functionCode": "const transformedItems = [];\n\nfor (const item of $input.all()) {\n  transformedItems.push({\n    json: {\n      customer_id: item.json.id,\n      display_name: `${item.json.first_name} ${item.json.last_name}`,\n      account_value: parseFloat(item.json.balance.replace(/[$,]/g, ''))\n    }\n  });\n}\n\nreturn transformedItems;"
  }
}
```

## FormIO: Form Building Platform

FormIO is a form building platform that dynamically generates forms from JSON schemas and collects user input data.

### FormIO Form Schema Structure

FormIO schemas define the structure, appearance, and behavior of forms through component definitions.

#### Basic Form Schema Example

```json
{
  "title": "Customer Registration",
  "name": "customerRegistration",
  "path": "customer-registration",
  "type": "form",
  "display": "form",
  "components": [
    {
      "type": "textfield",
      "key": "firstName",
      "label": "First Name",
      "placeholder": "Enter your first name",
      "input": true,
      "validate": {
        "required": true,
        "minLength": 2,
        "maxLength": 50
      }
    },
    {
      "type": "email",
      "key": "email",
      "label": "Email Address", 
      "placeholder": "Enter your email",
      "input": true,
      "validate": {
        "required": true
      }
    },
    {
      "type": "select",
      "key": "country",
      "label": "Country",
      "input": true,
      "data": {
        "values": [
          {"value": "us", "label": "United States"},
          {"value": "ca", "label": "Canada"},
          {"value": "uk", "label": "United Kingdom"}
        ]
      }
    },
    {
      "type": "button",
      "action": "submit",
      "label": "Submit Registration",
      "theme": "primary"
    }
  ]
}
```

#### Form Definition Properties

- **Meta Properties**:
  - `title`: Display name for the form
  - `name`: API-friendly identifier
  - `path`: URL path for form access
  - `type`: Form type ("form" or "resource")
  - `display`: Rendering mode ("form", "wizard", "pdf")

- **Component Array**: Defines all form fields and their behavior
  - `type`: Component type (textfield, select, button, etc.)
  - `key`: API field name for data storage
  - `label`: User-facing field label
  - `validate`: Validation rules object
  - `conditional`: Show/hide logic

### FormIO Table Components

FormIO supports tabular data through specialized components:

#### EditGrid Component Example

```json
{
  "label": "Invoice Line Items",
  "key": "lineItems",
  "type": "editgrid",
  "input": true,
  "components": [
    {
      "label": "Description",
      "key": "description",
      "type": "textfield",
      "input": true,
      "validate": {
        "required": true
      }
    },
    {
      "label": "Quantity",
      "key": "quantity", 
      "type": "number",
      "input": true,
      "validate": {
        "required": true,
        "min": 1
      }
    },
    {
      "label": "Unit Price",
      "key": "unitPrice",
      "type": "currency",
      "input": true,
      "validate": {
        "required": true
      }
    },
    {
      "label": "Total",
      "key": "total",
      "type": "currency",
      "input": true,
      "calculated": true,
      "calculateValue": "value = data.quantity * data.unitPrice"
    }
  ]
}
```

#### DataGrid vs EditGrid

- **DataGrid**: Inline editing within table cells
- **EditGrid**: Separate form view for each row, displays as table
- Both store data as arrays of objects

### FormIO Submission Data Structure

FormIO stores user responses in a standardized submission format:

```json
{
  "_id": "submission_123456789",
  "data": {
    "firstName": "John",
    "email": "john@example.com", 
    "country": "us",
    "lineItems": [
      {
        "description": "Software License",
        "quantity": 2,
        "unitPrice": 500.00,
        "total": 1000.00
      },
      {
        "description": "Support Services",
        "quantity": 1, 
        "unitPrice": 250.00,
        "total": 250.00
      }
    ]
  },
  "metadata": {
    "timezone": "America/New_York",
    "userAgent": "Mozilla/5.0..."
  },
  "state": "submitted",
  "form": "form_id_123",
  "project": "project_id_456",
  "created": "2024-01-15T10:30:00.000Z",
  "modified": "2024-01-15T10:30:00.000Z",
  "owner": "user_id_789"
}
```

#### Submission Structure Components

- **data**: Object containing all form field values
  - Keys match component `key` values from schema
  - Values are typed according to component type
  - Arrays for EditGrid/DataGrid components

- **System Fields**:
  - `_id`: Unique submission identifier
  - `state`: "draft" or "submitted"
  - `form`: Reference to form schema
  - `created`/`modified`: Timestamps
  - `owner`: User who submitted

- **metadata**: Additional context about submission
  - Timezone, user agent, custom metadata

## Key Differences Summary

| Aspect | n8n | FormIO |
|--------|-----|---------|
| **Primary Purpose** | Workflow automation & data processing | Form building & data collection |
| **Schema Defines** | Process flow and transformations | UI components and validation |
| **Data Flow** | Between processing nodes | From user to storage |
| **Schema Structure** | `nodes[]` + `connections{}` | `components[]` array |
| **Data Structure** | `[{json: {...}, binary: {...}}]` | `{data: {fieldKey: value}}` |
| **Transformations** | JavaScript expressions in node parameters | Validation rules and calculated fields |
| **Visual Layout** | Explicit coordinates for workflow canvas | Implicit order of form components |
| **Runtime Behavior** | Automated execution with data transformation | User interaction with form validation |
| **Array Handling** | All data is arrays of items | Arrays only for multi-row components |

## Data Mapping Approaches

### n8n: Expression-Based Mapping
- Uses `{{ }}` syntax for dynamic expressions
- References data with `$json`, `$node["NodeName"]`
- Supports full JavaScript for complex transformations
- Mappings stored as strings in node parameters

### FormIO: Schema-Driven Mapping  
- Component `key` values determine data structure
- Default values and calculated fields for dynamic content
- Validation rules enforce data integrity
- Conditional logic controls component visibility

Both platforms demonstrate different approaches to handling structured data and user interactions, with n8n focusing on automated data processing workflows and FormIO emphasizing dynamic form generation and user input collection.