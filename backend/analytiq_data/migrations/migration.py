from datetime import datetime, UTC
import analytiq_data as ad

class Migration:
    def __init__(self, version: int, description: str):
        self.version = version
        self.description = description
        
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
        super().__init__(1, "Rename OCR keys from _list to _json")
        
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
        super().__init__(2, "Add new fields to LLM results")
        
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

# List of all migrations in order
MIGRATIONS = [
    OcrKeyMigration(),
    LlmResultFieldsMigration(),
    # Add more migrations here
] 