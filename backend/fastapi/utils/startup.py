import sys, os

# Set up the path
cwd = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{cwd}/../..")

import analytiq_data as ad

async def create_admin(analytiq_client):
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
        
    try:
        db = analytiq_client.mongodb_async[env]
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
