# Database Migrations Guide

This document explains how to create and manage database migrations in the Analytiq project.

## Overview

The migration system allows you to make changes to the database schema in a versioned and reversible way. Each migration has an `up()` method to apply changes and a `down()` method to revert them.

## Migration System Structure

- `analytiq_data/migrations/migration.py` - Core migration system
- `analytiq_data/migrations/__init__.py` - Migration exports
- Individual migration classes in `migration.py`
- Migration version tracking in MongoDB's `migrations` collection

## Migration Process

### 1. Create a New Migration

Create a new class in `backend/analytiq_data/migrations/migration.py` that inherits from the `Migration` base class:

```python
class YourMigrationName(Migration):
    def __init__(self):
        super().__init__(
            version=2, # Increment from the last migration version
            description="Brief description of what this migration does"
        )
    async def up(self, db) -> bool:
        try:

        # Implement your migration logic here
        # Return True if successful
        return True
    
    except Exception as e:
        ad.log.error(f"Migration failed: {e}")
        return False
    
    async def down(self, db) -> bool:
        try:
        # Implement your rollback logic here
        # Return True if successful
        return True
    except Exception as e:
        ad.log.error(f"Migration revert failed: {e}")
        return False
```

### 2. Register the Migration

Add your migration to the `MIGRATIONS` list in `backend/analytiq_data/migrations/migration.py`:

```python
MIGRATIONS = [
    YourMigrationName(),
    # Add other migrations here
]
```

### 3. Testing Migrations

1. Test the upgrade path:
   ```python
   await ad.migrations.run_migrations(analytiq_client)
   ```

2. Test the downgrade path:
   ```python
   await ad.migrations.run_migrations(analytiq_client, target_version=1)
   ```

## Migration Examples

### Example 1: Renaming Fields

```python
class RenameFieldMigration(Migration):
    def __init__(self):
        super().__init__(
            version=2,
            description="Rename user.name to user.full_name"
        )
    async def up(self, db) -> bool:
        try:
            await db.users.update_many(
                {},
                {"$rename": {"name": "full_name"}}
            )
            return True
        except Exception as e:
            ad.log.error(f"Migration failed: {e}")
            return False

    async def down(self, db) -> bool:
        try:
            await db.users.update_many(
                {},
                {"$rename": {"full_name": "name"}}
            )
            return True
        except Exception as e:
            ad.log.error(f"Migration revert failed: {e}")
            return False
```

### Example 2: Adding a New Field

```python
class AddNewFieldMigration(Migration):
    def __init__(self):
        super().__init__(
            version=3,
            description="Add new_field to user collection"
        )
    async def up(self, db) -> bool:
        try:
            await db.users.update_many(
                {},
                {"$addFields": {"new_field": "new_value"}}
            )
            return True
        except Exception as e:
            ad.log.error(f"Migration failed: {e}")
            return False

    async def down(self, db) -> bool:
        try:
            await db.users.update_many(
                {},
                {"$unset": {"new_field": ""}}
            )
            return True
        except Exception as e:
            ad.log.error(f"Migration revert failed: {e}")
            return False
```

## Best Practices

1. **Version Numbers**: Always increment version numbers sequentially.
2. **Atomic Changes**: Each migration should make one logical change.
3. **Idempotency**: Migrations should be idempotent (can be run multiple times safely).
4. **Testing**: Test both `up` and `down` migrations before deploying.
5. **Documentation**: Include clear descriptions of what each migration does.
6. **Error Handling**: Always include proper error handling and logging.
7. **Backup**: Always backup your database before running migrations in production.

## Troubleshooting

If a migration fails:

1. Check the logs for detailed error messages
2. Fix any issues in the migration code
3. Revert to the previous version if needed:
   ```python
   await ad.migrations.run_migrations(analytiq_client, target_version=previous_version)
   ```
4. Try the migration again after fixing the issues

## Current Migrations

1. `OcrKeyMigration` (version 1): Renames OCR keys from `_list` to `_json`
