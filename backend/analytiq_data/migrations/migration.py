from datetime import datetime, UTC
import analytiq_data as ad

class Migration:
    def __init__(self, description: str):
        self.description = description
        # Version will be set when migrations are loaded
        self.version = None
        
    async def up(self, db) -> bool:
        """Execute the migration"""
        raise NotImplementedError
        
    async def down(self, db) -> bool:
        """Revert the migration"""
        raise NotImplementedError

async def get_current_version(db) -> int:
    """Get the current schema version"""
    migration_doc = await db.migrations.find_one(
        {"_id": "schema_version"},
        sort=[("version", -1)]
    )
    return migration_doc["version"] if migration_doc else 0

async def run_migrations(analytiq_client, target_version: int = None) -> None:
    """Run all pending migrations or up to target_version"""
    db = analytiq_client.mongodb_async[analytiq_client.env]
    current_version = await get_current_version(db)
    
    if target_version is None:
        target_version = len(MIGRATIONS)
        
    ad.log.info(f"Db current version: {current_version}, target version: {target_version}")

    try:
        if target_version > current_version:
            # Run migrations up
            for migration in MIGRATIONS[current_version:target_version]:
                ad.log.info(f"Running migration {migration.version}: {migration.description}")
                success = await migration.up(db)
                if success:
                    await db.migrations.update_one(
                        {"_id": "schema_version"},
                        {
                            "$set": {
                                "version": migration.version,
                                "updated_at": datetime.now(UTC)
                            }
                        },
                        upsert=True
                    )
                else:
                    raise Exception(f"Migration {migration.version} failed")
                    
        elif target_version < current_version:
            # Run migrations down
            for migration in reversed(MIGRATIONS[target_version:current_version]):
                ad.log.info(f"Reverting migration {migration.version}")
                success = await migration.down(db)
                if success:
                    await db.migrations.update_one(
                        {"_id": "schema_version"},
                        {
                            "$set": {
                                "version": migration.version - 1,
                                "updated_at": datetime.now(UTC)
                            }
                        }
                    )
                else:
                    raise Exception(f"Migration revert {migration.version} failed")
                    
    except Exception as e:
        ad.log.error(f"Migration failed: {e}")
        raise

# Example migration for OCR key renaming
class OcrKeyMigration(Migration):
    def __init__(self):
        super().__init__(description="Rename OCR keys from _list to _json")
        
    async def up(self, db) -> bool:
        try:
            cursor = db["ocr.files"].find({"filename": {"$regex": "_list$"}})
            async for doc in cursor:
                old_key = doc["filename"]
                new_key = old_key.replace("_list", "_json")
                await db["ocr.files"].update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"filename": new_key}}
                )
            return True
        except Exception as e:
            ad.log.error(f"Migration failed: {e}")
            return False
            
    async def down(self, db) -> bool:
        try:
            cursor = db["ocr.files"].find({"filename": {"$regex": "_json$"}})
            async for doc in cursor:
                old_key = doc["filename"]
                new_key = old_key.replace("_json", "_list")
                await db["ocr.files"].update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"filename": new_key}}
                )
            return True
        except Exception as e:
            ad.log.error(f"Migration revert failed: {e}")
            return False

class LlmResultFieldsMigration(Migration):
    def __init__(self):
        super().__init__(description="Add new fields to LLM results")
        
    async def up(self, db) -> bool:
        """Add updated_llm_result, is_edited, is_verified, created_at, updated_at fields"""
        try:
            current_time = datetime.now(UTC)
            
            # Find all documents in llm.runs collection
            cursor = db["llm.runs"].find({})
            async for doc in cursor:
                update_fields = {}
                
                # Add updated_llm_result if missing
                if "updated_llm_result" not in doc:
                    update_fields["updated_llm_result"] = doc["llm_result"]
                
                # Add timestamps if missing
                if "created_at" not in doc:
                    update_fields["created_at"] = current_time
                if "updated_at" not in doc:
                    update_fields["updated_at"] = current_time
                    
                # Add status flags if missing
                if "is_edited" not in doc:
                    update_fields["is_edited"] = False
                if "is_verified" not in doc:
                    update_fields["is_verified"] = False
                
                # Only update if there are missing fields
                if update_fields:
                    await db["llm.runs"].update_one(
                        {"_id": doc["_id"]},
                        {"$set": update_fields}
                    )
            
            return True
            
        except Exception as e:
            ad.log.error(f"LLM results migration failed: {e}")
            return False
    
    async def down(self, db) -> bool:
        """Remove added fields"""
        try:
            await db["llm.runs"].update_many(
                {},
                {
                    "$unset": {
                        "updated_llm_result": "",
                        "is_edited": "",
                        "is_verified": "",
                        "created_at": "",
                        "updated_at": ""
                    }
                }
            )
            return True
            
        except Exception as e:
            ad.log.error(f"LLM results migration revert failed: {e}")
            return False

# Add this new migration class
class SchemaJsonSchemaMigration(Migration):
    def __init__(self):
        super().__init__(description="Convert schemas to JsonSchema format")
        
    def convert_to_json_schema(self, fields):
        """Convert old field format to JsonSchema format"""
        json_schema = {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False
        }
        
        for field in fields:
            field_name = field["name"]
            field_type = field["type"]
            
            # Convert Python/Pydantic types to JSON Schema types
            if field_type == "str":
                json_type = "string"
            elif field_type == "int":
                json_type = "integer"
            elif field_type == "float":
                json_type = "number"
            elif field_type == "bool":
                json_type = "boolean"
            elif field_type == "datetime":
                json_type = "string"
                json_schema["properties"][field_name] = {
                    "type": "string",
                    "format": "date-time",
                    "description": field_name.replace("_", " ")
                }
                json_schema["required"].append(field_name)
                continue
            else:
                json_type = "string"
            
            json_schema["properties"][field_name] = {
                "type": json_type,
                "description": field_name.replace("_", " ")
            }
            json_schema["required"].append(field_name)
        
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "document_extraction",
                "schema": json_schema,
                "strict": True
            }
        }
        
    async def up(self, db) -> bool:
        """Convert existing schemas to JsonSchema format"""
        try:
            cursor = db.schemas.find({})
            async for schema in cursor:
                # Convert fields to JsonSchema
                json_schema = self.convert_to_json_schema(schema["fields"])
                
                # Update the document
                await db.schemas.update_one(
                    {"_id": schema["_id"]},
                    {
                        "$set": {
                            "json_schema": json_schema,
                            "schema_format": "json_schema"
                        },
                        "$unset": {"fields": ""}
                    }
                )
            return True
            
        except Exception as e:
            ad.log.error(f"Schema migration failed: {e}")
            return False
    
    async def down(self, db) -> bool:
        """Convert JsonSchema back to old format"""
        try:
            cursor = db.schemas.find({"schema_format": "json_schema"})
            async for schema in cursor:
                json_schema = schema.get("json_schema", {})
                properties = json_schema.get("json_schema", {}).get("schema", {}).get("properties", {})
                
                fields = []
                for field_name, field_def in properties.items():
                    field_type = field_def["type"]
                    if field_type == "string" and field_def.get("format") == "date-time":
                        field_type = "datetime"
                    elif field_type == "string":
                        field_type = "str"
                    elif field_type == "integer":
                        field_type = "int"
                    elif field_type == "number":
                        field_type = "float"
                    elif field_type == "boolean":
                        field_type = "bool"
                    
                    fields.append({
                        "name": field_name,
                        "type": field_type
                    })
                
                await db.schemas.update_one(
                    {"_id": schema["_id"]},
                    {
                        "$set": {"fields": fields},
                        "$unset": {
                            "json_schema": "",
                            "schema_format": ""
                        }
                    }
                )
            return True
            
        except Exception as e:
            ad.log.error(f"Schema migration revert failed: {e}")
            return False

class RenameJsonSchemaToResponseFormat(Migration):
    def __init__(self):
        super().__init__(description="Rename json_schema field to response_format in schemas collection")

    async def up(self, db) -> bool:
        try:
            # Update all documents in schemas collection
            result = await db.schemas.update_many(
                {"json_schema": {"$exists": True}},
                [
                    {
                        "$set": {
                            "response_format": "$json_schema",
                            "json_schema": "$$REMOVE"
                        }
                    }
                ]
            )
            ad.log.info(f"Updated {result.modified_count} schemas")
            return True
        except Exception as e:
            ad.log.error(f"Migration failed: {e}")
            return False

    async def down(self, db) -> bool:
        try:
            # Revert the changes
            result = await db.schemas.update_many(
                {"response_format": {"$exists": True}},
                [
                    {
                        "$set": {
                            "json_schema": "$response_format",
                            "response_format": "$$REMOVE"
                        }
                    }
                ]
            )
            ad.log.info(f"Reverted {result.modified_count} schemas")
            return True
        except Exception as e:
            ad.log.error(f"Migration revert failed: {e}")
            return False

class RemoveSchemaFormatField(Migration):
    def __init__(self):
        super().__init__(description="Remove redundant schema_format field from schemas collection")

    async def up(self, db) -> bool:
        try:
            result = await db.schemas.update_many(
                {"schema_format": {"$exists": True}},
                {"$unset": {"schema_format": ""}}
            )
            ad.log.info(f"Removed schema_format field from {result.modified_count} schemas")
            return True
        except Exception as e:
            ad.log.error(f"Migration failed: {e}")
            return False

    async def down(self, db) -> bool:
        try:
            # Restore schema_format field to 'json_schema' for all documents
            result = await db.schemas.update_many(
                {},
                {"$set": {"schema_format": "json_schema"}}
            )
            ad.log.info(f"Restored schema_format field to {result.modified_count} schemas")
            return True
        except Exception as e:
            ad.log.error(f"Migration revert failed: {e}")
            return False

# List of all migrations in order
MIGRATIONS = [
    OcrKeyMigration(),
    LlmResultFieldsMigration(),
    SchemaJsonSchemaMigration(),
    RenameJsonSchemaToResponseFormat(),
    RemoveSchemaFormatField(),
    # Add more migrations here
]

# Set versions based on position in list
for i, migration in enumerate(MIGRATIONS, start=1):
    migration.version = i 