import { ObjectId } from "mongodb";
import mongoClient from "./mongodb";

export async function createDefaultOrganization(userId: string) {
    const db = mongoClient.db();
    
    const existingOrganization = await db.collection("organizations").findOne({ _id: new ObjectId(userId) });
    if (existingOrganization) {
        console.log("Organization already exists");
        return { status: "already_exists" };
    }
    
    const organization = {
        _id: new ObjectId(userId),
        name: "Default",
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