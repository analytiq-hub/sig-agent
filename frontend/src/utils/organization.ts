import { ObjectId } from "mongodb";
import mongoClient from "./mongodb";

export async function createDefaultOrganization(userId: string, email: string) {
    const db = mongoClient.db();
    
    // Delete any existing personal organizations for this user
    await db.collection("organizations").deleteMany({
        "members.user_id": userId,
        isPersonal: true
    });
    
    const organization = {
        _id: new ObjectId(userId),
        name: email,  // Use email as name
        isPersonal: true,  // Mark as personal
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