import { ObjectId } from "mongodb";
import mongoClient from "./mongodb";

export async function createDefaultWorkspace(userId: string) {
    const db = mongoClient.db();
    
    // First check if workspace already exists
    const existingWorkspace = await db.collection("workspaces").findOne({ _id: new ObjectId(userId) });
    if (existingWorkspace) {
        console.log("Workspace already exists");
        return { status: "already_exists" };
    }
    
    // Create personal workspace with same format as FastAPI
    const workspace = {
        _id: new ObjectId(userId),
        name: "Default",
        owner_id: userId,
        members: [{
            user_id: userId,
            role: "owner"
        }],
        created_at: new Date(),
        updated_at: new Date()
    };

    try {
        await db.collection("workspaces").insertOne(workspace);
        return { status: "success" };
    } catch (error: unknown) {
        // Still handle potential race condition errors
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
            console.log("Workspace already exists");
            return { status: "already_exists" };
        }
        throw error;
    }
}
