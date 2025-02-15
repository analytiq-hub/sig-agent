import { ObjectId } from "mongodb";
import mongoClient from "./mongodb";
import { Db } from "mongodb";

export async function createDefaultOrganization(userId: string, email: string) {
    const db = mongoClient.db();
    
    // Delete any existing individual organizations for this user
    await db.collection("organizations").deleteMany({
        "members.user_id": userId,
        type: "individual"
    });
    
    const organization = {
        _id: new ObjectId(userId),
        name: email,  // Use email as name
        type: "individual",  // Mark as individual
        members: [{
            user_id: userId,
            role: "admin"
        }],
        created_at: new Date(),
        updated_at: new Date()
    };

    try {
        await db.collection("organizations").insertOne(organization);
        return { status: "success" };
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
            console.log("Organization already exists");
            return { status: "already_exists" };
        }
        throw error;
    }
}

export async function getFirstOrganization(db: Db, userId: string) {
  try {
    // First try to get organizations where user is a member
    const userOrgs = await db.collection('organization_members')
      .find({ userId })
      .toArray();
    
    if (userOrgs.length > 0) {
      // Get the first organization's details
      const org = await db.collection('organizations')
        .findOne({ _id: userOrgs[0].organizationId });
      return org;
    }
    
    // If no organizations found where user is a member,
    // look for organizations they own
    const ownedOrg = await db.collection('organizations')
      .findOne({ ownerId: userId });
      
    return ownedOrg;
  } catch (error) {
    console.error('Error getting first organization:', error);
    return null;
  }
} 