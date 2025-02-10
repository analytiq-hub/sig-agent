import sys, os
from datetime import datetime, UTC
from bcrypt import hashpw, gensalt
from bson import ObjectId

# Set up the path
cwd = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{cwd}/..")

import analytiq_data as ad

async def setup_llm_models(db):
    """Set up default LLM models by upserting based on model name"""
    # Default LLM models
    default_models = [
        {
            "name": "gpt-4o-mini",
            "provider": "openai",
            "description": "Smaller, faster version of GPT-4",
            "max_tokens": 128000,
            "cost_per_1m_input_tokens": 0.15,
            "cost_per_1m_output_tokens": 0.6
        },
        {
            "name": "gpt-4-turbo",
            "provider": "openai",
            "description": "Latest version of GPT-4 with improved performance",
            "max_tokens": 128000,
            "cost_per_1m_input_tokens": 2.5,
            "cost_per_1m_output_tokens": 10
        },
        {
            "name": "o1-mini",
            "provider": "openai",
            "description": "OpenAI O1 Mini",
            "max_tokens": 200000,
            "cost_per_1m_input_tokens": 15,
            "cost_per_1m_output_tokens": 60
        },
        {
            "name": "o3-mini",
            "provider": "openai",
            "description": "OpenAI O3 Mini",
            "max_tokens": 200000,
            "cost_per_1m_input_tokens": 1.10,
            "cost_per_1m_output_tokens": 4.4
        },
        {
            "name": "anthropic/claude-3.5",
            "provider": "anthropic",
            "description": "Latest Claude model optimized for reliability and safety",
            "max_tokens": 200000,
            "cost_per_1m_input_tokens": 3,
            "cost_per_1m_output_tokens": 15
        },
        # {
        #     "name": "gemini/gemini-2.0-pro",
        #     "provider": "google",
        #     "description": "Gemini 2.0 Pro",
        #     "max_tokens": 200000,
        #     "cost_per_1m_input_tokens": 0.1, # For now, model is free
        #     "cost_per_1m_output_tokens": 0.4 # For now, model is free
        # },
        {
            "name": "gemini/gemini-2.0-flash",
            "provider": "google",
            "description": "Gemini 2.0 Flash",
            "max_tokens": 1000000,
            "cost_per_1m_input_tokens": 0.1,
            "cost_per_1m_output_tokens": 0.4
        },
        {
            "name": "groq/deepseek-r1-distill-llama-70b",
            "provider": "groq",
            "description": "High performance open source model optimized for Groq",
            "max_tokens": 128000,
            "cost_per_1m_input_tokens": 0.59,
            "cost_per_1m_output_tokens": 0.79
        }
    ]

    try:
        # Upsert each model individually using the name as the unique identifier
        for model in default_models:
            await db.llm_models.update_one(
                {"name": model["name"]},  # filter by name
                {"$set": model},  # update/insert the entire model document
                upsert=True  # create if doesn't exist, update if exists
            )
        ad.log.info("LLM models upserted successfully")
    except Exception as e:
        ad.log.error(f"Failed to upsert LLM models: {e}")

    # Remove any models that are not in the default_models list
    await db.llm_models.delete_many({
        "name": {"$nin": [model["name"] for model in default_models]}
    })

async def setup_database(analytiq_client):
    """Set up database and run migrations"""
    try:
        await ad.migrations.run_migrations(analytiq_client)
    except Exception as e:
        ad.log.error(f"Database migration failed: {e}")
        raise

async def setup_admin(analytiq_client):
    """
    Create admin user during application startup if it doesn't exist
    """
    # Get environment
    env = analytiq_client.env

    # Get admin email and password from environment variables
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    
    if not admin_email or not admin_password:
        return

    # Run migrations
    await setup_database(analytiq_client)

    try:
        db = analytiq_client.mongodb_async[env]
        
        # Initialize LLM models
        await setup_llm_models(db)
        
        users = db.users
        
        # Check if admin already exists
        existing_admin = await users.find_one({"email": admin_email})
        if existing_admin:
            return
            
        # Create admin user with bcrypt hash
        hashed_password = hashpw(admin_password.encode(), gensalt(12))
        result = await users.insert_one({
            "email": admin_email,
            "password": hashed_password.decode(),
            "name": "System Administrator",
            "role": "admin",
            "emailVerified": True,
            "createdAt": datetime.now(UTC)
        })
        
        admin_id = str(result.inserted_id)
        
        # Create organization for admin
        await db.organizations.insert_one({
            "_id": ObjectId(admin_id),
            "name": "Admin",
            "type": "individual",
            "members": [{
                "user_id": admin_id,
                "role": "admin"
            }],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        ad.log.info(f"Created default admin user: {admin_email}")
    except Exception as e:
        ad.log.error(f"Failed to create default admin: {e}")

async def setup_api_creds(analytiq_client):
    """
    Set up API credentials for various services during startup
    """
    try:
        env = analytiq_client.env
        db = analytiq_client.mongodb_async[env]
        
        # Get system admin user
        admin_email = os.getenv("ADMIN_EMAIL")
        if not admin_email:
            return
            
        admin_user = await db.users.find_one({"email": admin_email})
        if not admin_user:
            return
            
        admin_id = str(admin_user["_id"])
        
        # AWS Credentials. Only store credentials if they don't already exist.
        aws_access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
        aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
        existing_aws_creds = await db.aws_credentials.find_one({"user_id": admin_id})
        
        if aws_access_key != "" and aws_secret_key != "" and not existing_aws_creds:
            # Encrypt credentials before storing
            encrypted_access_key = ad.crypto.encrypt_token(aws_access_key)
            encrypted_secret_key = ad.crypto.encrypt_token(aws_secret_key)
            
            await db.aws_credentials.update_one(
                {"user_id": admin_id},
                {
                    "$set": {
                        "access_key_id": encrypted_access_key,
                        "secret_access_key": encrypted_secret_key,
                        "created_at": datetime.now(UTC)
                    }
                },
                upsert=True
            )
            ad.log.info("AWS credentials configured for admin user")
            
        # LLM API Keys
        llm_credentials = []
        
        # OpenAI
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key != "":
            llm_credentials.append(("OpenAI", openai_key))
            
        # Anthropic
        anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        if anthropic_key != "":
            llm_credentials.append(("Anthropic", anthropic_key))

        # Gemini
        gemini_key = os.getenv("GEMINI_API_KEY", "")
        if gemini_key != "":
            llm_credentials.append(("Gemini", gemini_key))
            
        # Groq
        groq_key = os.getenv("GROQ_API_KEY", "")
        if groq_key != "":
            llm_credentials.append(("Groq", groq_key))
            
        # Store LLM credentials
        for vendor, api_key in llm_credentials:
            # Only store credentials if they don't already exist
            existing_llm_creds = await db.llm_tokens.find_one({"user_id": admin_id, "llm_vendor": vendor})
            if existing_llm_creds:
                continue
                
            encrypted_key = ad.crypto.encrypt_token(api_key)
            await db.llm_tokens.update_one(
                {
                    "user_id": admin_id,
                    "llm_vendor": vendor
                },
                {
                    "$set": {
                        "token": encrypted_key,
                        "created_at": datetime.now(UTC)
                    }
                },
                upsert=True
            )
            ad.log.info(f"{vendor} API key configured for admin user")
            
    except Exception as e:
        ad.log.error(f"Failed to set up API credentials: {e}")