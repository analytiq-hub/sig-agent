# DocRouter Code Structure Recommendations

## Current Structure Issues
- **docrouter_sdk** does not depend on other modules, but needs to import other modules during unit testing.
- **analytiq_data** eventually needs to be installed on its own, separate from docrouter_sdk.
- **api** and **worker** depend on analytiq_data. The docrouter_sdk currently does not, but in the future it might.
- The frontend is a separate npm-based package

## Recommended Monorepo Structure 
This is not implemented yet, but here is a good project structure. We could slowly change towards this structure:
```
doc-router/
├── packages/ # Backend packages
│ ├── pyproject.toml # Unified package with optional dependencies
│ ├── docrouter_sdk/ # SDK implementation
│ │ ├── api/ # API client implementation
│ │ ├── models/ # Data models
│ │ └── example/ # Example code
│ │
│ ├── analytiq_data/ # Data handling implementation
│ │ ├── common/ # Common utilities
│ │ ├── mongodb/ # MongoDB integration
│ │ └── llm/ # LLM integration
│ │
│ ├── api/ # API implementation
│ │ └── main.py # FastAPI implementation
│ │
│ ├── worker/ # Worker implementation
│ │ └── worker.py # Background worker tasks
│ │
│ └── tests/ # Tests for all packages
│
├── frontend/ # Next.js frontend application
│ ├── public/ # Static assets
│ ├── src/
│ │ ├── app/ # App Router components
│ │ ├── components/ # Shared React components
│ │ ├── lib/ # Utility functions
│ │ └── styles/ # Global styles
│ ├── package.json # Frontend dependencies
│ └── next.config.mjs # Next.js configuration
│
├── tools/ # Shared development tools
│ ├── eslint-config/ # Shared ESLint configurations
│ └── scripts/ # Development scripts
│
├── docker/ # Docker configurations
│ ├── api/ # API service Dockerfile
│ ├── worker/ # Worker service Dockerfile
│ └── frontend/ # Frontend Dockerfile
│
├── docs/ # Project documentation
├── package.json # Root package.json for scripts
├── docker-compose.yml # Development environment setup
└── README.md # Project overview
```

## Dependencies Management

### Python Package Dependencies
- Each Python package should have its own `pyproject.toml` file:

```toml
# Example for docrouter-sdk/pyproject.toml
[project]
name = "docrouter-sdk"
version = "0.1.0"
description = "Python client library for the Smart Document Router API"
# ... other metadata ...
dependencies = [
    "requests>=2.0.0",
    "pydantic>=2.0.0",
    "python-dateutil>=2.0.0"
]

[project.optional-dependencies]
test = [
    "pytest>=7.0.0",
    "analytiq-data[test]",  # For testing only
]
```

### Root package.json for JavaScript/TypeScript
```json
{
  "name": "doc-router",
  "private": true,
  "scripts": {
    "dev": "docker-compose up",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:api": "cd packages/docrouter-api && python -m api.main",
    "dev:worker": "cd packages/docrouter-api && python -m worker.worker",
    "build": "npm run build:frontend && npm run build:backend",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd packages && python -m pip install -e ./docrouter-sdk -e ./analytiq-data -e ./docrouter-api",
    "test": "npm run test:frontend && npm run test:backend",
    "test:frontend": "cd frontend && npm test",
    "test:backend": "cd packages && pytest"
  },
  "workspaces": [
    "frontend",
    "tools/*"
  ]
}
```

## Testing Strategy
- Keep unit tests within each package
- For `docrouter_sdk` tests that need `analytiq_data`, use pytest fixtures to mock the dependencies or include test-only imports
- Set up integration tests separately in a dedicated directory
- Consider using GitHub Actions for CI/CD to test each package independently

## API Client Generation
Consider adding OpenAPI/Swagger specs in the API package and use a tool like OpenAPI Generator to create frontend client code:

```json
// In frontend/package.json
{
  "scripts": {
    "generate-api": "openapi-generator-cli generate -i ../packages/docrouter-api/openapi.yaml -g typescript-fetch -o src/api/client"
  }
}
```

## Environment Management
- Create a unified environment variable scheme
- Use `.env.example` files in each package
- Add scripts to propagate environment variables across packages

## Development Workflow
- Use Docker Compose for local development
- Create specialized dev scripts for each component
- Implement hot-reloading for both frontend and backend

## Continuous Integration
Set up GitHub Actions workflows for:
- Building and testing each package independently
- End-to-end testing across packages
- Deployment pipelines for each component

## Benefits of This Approach
- Independent installation of each package
- Clear dependency boundaries
- Easy testing setup
- Ability to version each package independently
- Future flexibility to move packages out to separate repositories if needed
- Unified development experience across the full stack