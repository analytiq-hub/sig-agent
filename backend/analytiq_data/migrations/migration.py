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
                    if field_type == "string":
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

# Add this new migration class
class AddStableIdentifiers(Migration):
    def __init__(self):
        super().__init__(description="Add stable schema_id and prompt_id fields to schemas and prompts")
        
    async def up(self, db) -> bool:
        """Add schema_id and prompt_id fields"""
        try:
            # First, get existing normalized IDs to avoid duplicates
            existing_schema_ids = set()
            existing_prompt_ids = set()
            
            async for doc in db.schema_versions.find({}):
                existing_schema_ids.add(doc["_id"])
                
            async for doc in db.prompt_versions.find({}):
                existing_prompt_ids.add(doc["_id"])
            
            # Process schema_versions collection
            schema_versions_cursor = db.schema_versions.find({})
            to_delete_schema_ids = []
            to_insert_schema_docs = []
            schema_id_map = {}  # original_id -> normalized_id
            
            async for version_doc in schema_versions_cursor:
                original_id = version_doc["_id"]
                base_id = original_id.lower().replace(" ", "_")
                
                # Ensure ID uniqueness
                normalized_id = base_id
                counter = 1
                while normalized_id in existing_schema_ids and normalized_id != original_id:
                    normalized_id = f"{base_id}_{counter}"
                    counter += 1
                
                existing_schema_ids.add(normalized_id)
                schema_id_map[original_id] = normalized_id
                
                if normalized_id != original_id:
                    to_delete_schema_ids.append(original_id)
                    to_insert_schema_docs.append({
                        "_id": normalized_id,
                        "version": version_doc["version"]
                    })
            
            # Process prompt_versions collection
            prompt_versions_cursor = db.prompt_versions.find({})
            to_delete_prompt_ids = []
            to_insert_prompt_docs = []
            prompt_id_map = {}  # original_id -> normalized_id
            
            async for version_doc in prompt_versions_cursor:
                original_id = version_doc["_id"]
                base_id = original_id.lower().replace(" ", "_")
                
                # Ensure ID uniqueness
                normalized_id = base_id
                counter = 1
                while normalized_id in existing_prompt_ids and normalized_id != original_id:
                    normalized_id = f"{base_id}_{counter}"
                    counter += 1
                
                existing_prompt_ids.add(normalized_id)
                prompt_id_map[original_id] = normalized_id
                
                if normalized_id != original_id:
                    to_delete_prompt_ids.append(original_id)
                    to_insert_prompt_docs.append({
                        "_id": normalized_id,
                        "version": version_doc["version"]
                    })
            
            # Insert new documents first (to avoid conflicts if IDs already normalized)
            for doc in to_insert_schema_docs:
                try:
                    await db.schema_versions.insert_one(doc)
                except Exception as e:
                    ad.log.warning(f"Could not insert schema version {doc['_id']}: {e}")
            
            for doc in to_insert_prompt_docs:
                try:
                    await db.prompt_versions.insert_one(doc)
                except Exception as e:
                    ad.log.warning(f"Could not insert prompt version {doc['_id']}: {e}")
            
            # Then delete old documents
            for old_id in to_delete_schema_ids:
                try:
                    await db.schema_versions.delete_one({"_id": old_id})
                except Exception as e:
                    ad.log.warning(f"Could not delete schema version {old_id}: {e}")
            
            for old_id in to_delete_prompt_ids:
                try:
                    await db.prompt_versions.delete_one({"_id": old_id})
                except Exception as e:
                    ad.log.warning(f"Could not delete prompt version {old_id}: {e}")
            
            # Add schema_id to schemas
            schemas_cursor = db.schemas.find({"schema_id": {"$exists": False}})
            schema_names_processed = set()
            
            async for schema in schemas_cursor:
                schema_name = schema["name"]
                
                if schema_name not in schema_names_processed:
                    # Get normalized ID from map or create if not exists
                    if schema_name in schema_id_map:
                        schema_id = schema_id_map[schema_name]
                    else:
                        base_id = schema_name.lower().replace(" ", "_")
                        schema_id = base_id
                        counter = 1
                        while schema_id in existing_schema_ids and schema_id != schema_name:
                            schema_id = f"{base_id}_{counter}"
                            counter += 1
                    
                    schema_names_processed.add(schema_name)
                    
                    # Update all versions of this schema with the same schema_id
                    await db.schemas.update_many(
                        {"name": schema_name},
                        {"$set": {"schema_id": schema_id}}
                    )
            
            # Add prompt_id to prompts
            prompts_cursor = db.prompts.find({"prompt_id": {"$exists": False}})
            prompt_names_processed = set()
            
            async for prompt in prompts_cursor:
                prompt_name = prompt["name"]
                
                if prompt_name not in prompt_names_processed:
                    # Get normalized ID from map or create if not exists
                    if prompt_name in prompt_id_map:
                        prompt_id = prompt_id_map[prompt_name]
                    else:
                        base_id = prompt_name.lower().replace(" ", "_")
                        prompt_id = base_id
                        counter = 1
                        while prompt_id in existing_prompt_ids and prompt_id != prompt_name:
                            prompt_id = f"{base_id}_{counter}"
                            counter += 1
                    
                    prompt_names_processed.add(prompt_name)
                    
                    # Update all versions with prompt_id
                    update_doc = {"prompt_id": prompt_id}
                    
                    # Also update schema_id if schema_name exists
                    if "schema_name" in prompt and prompt["schema_name"]:
                        if prompt["schema_name"] in schema_id_map:
                            update_doc["schema_id"] = schema_id_map[prompt["schema_name"]]
                        else:
                            schema_id = prompt["schema_name"].lower().replace(" ", "_")
                            update_doc["schema_id"] = schema_id
                    
                    await db.prompts.update_many(
                        {"name": prompt_name},
                        {"$set": update_doc}
                    )
            
            return True
            
        except Exception as e:
            ad.log.error(f"Migration failed: {e}")
            return False
    
    async def down(self, db) -> bool:
        """Remove schema_id and prompt_id fields"""
        try:
            # Get mappings of ids to names
            schema_id_to_name = {}
            prompt_id_to_name = {}
            
            async for schema in db.schemas.find({"schema_id": {"$exists": True}}):
                schema_id_to_name[schema["schema_id"]] = schema["name"]
            
            async for prompt in db.prompts.find({"prompt_id": {"$exists": True}}):
                prompt_id_to_name[prompt["prompt_id"]] = prompt["name"]
            
            # Collect version entries to restore
            schema_versions_to_restore = []
            existing_schema_versions = set()
            
            async for version_doc in db.schema_versions.find({}):
                schema_id = version_doc["_id"]
                if schema_id in schema_id_to_name:
                    schema_name = schema_id_to_name[schema_id]
                    if schema_name not in existing_schema_versions:
                        schema_versions_to_restore.append({
                            "_id": schema_name,
                            "version": version_doc["version"]
                        })
                        existing_schema_versions.add(schema_name)
            
            prompt_versions_to_restore = []
            existing_prompt_versions = set()
            
            async for version_doc in db.prompt_versions.find({}):
                prompt_id = version_doc["_id"]
                if prompt_id in prompt_id_to_name:
                    prompt_name = prompt_id_to_name[prompt_id]
                    if prompt_name not in existing_prompt_versions:
                        prompt_versions_to_restore.append({
                            "_id": prompt_name,
                            "version": version_doc["version"]
                        })
                        existing_prompt_versions.add(prompt_name)
            
            # Insert new documents before removing old ones
            for doc in schema_versions_to_restore:
                try:
                    await db.schema_versions.insert_one(doc)
                except Exception as e:
                    ad.log.warning(f"Could not insert schema version with original name {doc['_id']}: {e}")
            
            for doc in prompt_versions_to_restore:
                try:
                    await db.prompt_versions.insert_one(doc)
                except Exception as e:
                    ad.log.warning(f"Could not insert prompt version with original name {doc['_id']}: {e}")
            
            # Remove new normalized version entries 
            for schema_id in schema_id_to_name.keys():
                try:
                    await db.schema_versions.delete_one({"_id": schema_id})
                except Exception as e:
                    ad.log.warning(f"Could not delete schema version {schema_id}: {e}")
            
            for prompt_id in prompt_id_to_name.keys():
                try:
                    await db.prompt_versions.delete_one({"_id": prompt_id})
                except Exception as e:
                    ad.log.warning(f"Could not delete prompt version {prompt_id}: {e}")
            
            # Remove fields from schemas and prompts
            await db.schemas.update_many(
                {"schema_id": {"$exists": True}},
                {"$unset": {"schema_id": ""}}
            )
            
            await db.prompts.update_many(
                {
                    "$or": [
                        {"prompt_id": {"$exists": True}},
                        {"schema_id": {"$exists": True}}
                    ]
                },
                {
                    "$unset": {
                        "prompt_id": "",
                        "schema_id": ""
                    }
                }
            )
            
            return True
        except Exception as e:
            ad.log.error(f"Migration revert failed: {e}")
            return False

# Add migration to rename the 'version' field to 'prompt_version' in prompts collection
class RenamePromptVersion(Migration):
    def __init__(self):
        super().__init__(description="Rename version field to prompt_version in prompts collection")

    async def up(self, db) -> bool:
        try:
            # Update all documents in prompts collection
            result = await db.prompts.update_many(
                {},
                [
                    {
                        "$set": {
                            "prompt_version": "$version",
                            "version": "$$REMOVE"
                        }
                    }
                ]
            )
            ad.log.info(f"Updated {result.modified_count} prompts")
            return True
        except Exception as e:
            ad.log.error(f"Migration failed: {e}")
            return False

    async def down(self, db) -> bool:
        try:
            # Revert the changes
            result = await db.prompts.update_many(
                {},
                [
                    {
                        "$set": {
                            "version": "$prompt_version",
                            "prompt_version": "$$REMOVE"
                        }
                    }
                ]
            )
            ad.log.info(f"Reverted {result.modified_count} prompts")
            return True
        except Exception as e:
            ad.log.error(f"Migration revert failed: {e}")
            return False

# Add a migration to rename 'version' to 'schema_version' in schemas collection
class RenameSchemaVersion(Migration):
    def __init__(self):
        super().__init__(description="Rename version to schema_version in schemas collection")
    
    async def up(self, db) -> bool:
        try:
            # Update all documents in schemas collection
            async for schema in db.schemas.find({}):
                await db.schemas.update_one(
                    {"_id": schema["_id"]},
                    {"$rename": {"version": "schema_version"}}
                )
            
            # Update all documents in schema_versions collection
            async for doc in db.schema_versions.find({}):
                await db.schema_versions.update_one(
                    {"_id": doc["_id"]},
                    {"$rename": {"version": "schema_version"}}
                )
            
            return True
        except Exception as e:
            ad.log.error(f"Schema version rename migration failed: {e}")
            return False
    
    async def down(self, db) -> bool:
        try:
            # Revert changes
            async for schema in db.schemas.find({}):
                await db.schemas.update_one(
                    {"_id": schema["_id"]},
                    {"$rename": {"schema_version": "version"}}
                )
            
            async for doc in db.schema_versions.find({}):
                await db.schema_versions.update_one(
                    {"_id": doc["_id"]},
                    {"$rename": {"schema_version": "version"}}
                )
            
            return True
        except Exception as e:
            ad.log.error(f"Schema version rename migration revert failed: {e}")
            return False

# Add this new migration class before the MIGRATIONS list
class RemoveSchemaNameField(Migration):
    def __init__(self):
        super().__init__(description="Remove schema_name field from prompts collection")
        
    async def up(self, db) -> bool:
        """Remove schema_name field from prompts collection"""
        try:
            # Remove schema_name field from all documents in prompts collection
            result = await db.prompts.update_many(
                {"schema_name": {"$exists": True}},
                {"$unset": {"schema_name": ""}}
            )
            
            ad.log.info(f"Removed schema_name field from {result.modified_count} documents")
            return True
            
        except Exception as e:
            ad.log.error(f"Remove schema_name field migration failed: {e}")
            return False
    
    async def down(self, db) -> bool:
        """Restore schema_name field using schema_id to look up schemas"""
        try:
            # For each prompt with schema_id, look up the schema and add its name
            cursor = db.prompts.find({"schema_id": {"$exists": True, "$ne": None}})
            
            restored_count = 0
            async for prompt in cursor:
                if "schema_id" in prompt and prompt["schema_id"]:
                    # Find the corresponding schema
                    schema = await db.schemas.find_one({
                        "schema_id": prompt["schema_id"],
                        "schema_version": prompt.get("schema_version", 1)
                    })
                    
                    if schema and "name" in schema:
                        # Update the prompt with the schema name
                        await db.prompts.update_one(
                            {"_id": prompt["_id"]},
                            {"$set": {"schema_name": schema["name"]}}
                        )
                        restored_count += 1
            
            ad.log.info(f"Restored schema_name field for {restored_count} documents")
            return True
            
        except Exception as e:
            ad.log.error(f"Restore schema_name field migration failed: {e}")
            return False

# List of all migrations in order
MIGRATIONS = [
    OcrKeyMigration(),
    LlmResultFieldsMigration(),
    SchemaJsonSchemaMigration(),
    RenameJsonSchemaToResponseFormat(),
    RemoveSchemaFormatField(),
    AddStableIdentifiers(),
    RenamePromptVersion(),
    RenameSchemaVersion(),
    RemoveSchemaNameField(),
    # Add more migrations here
]

# Set versions based on position in list
for i, migration in enumerate(MIGRATIONS, start=1):
    migration.version = i 