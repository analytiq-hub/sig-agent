import { NextResponse } from 'next/server';
import mongoClient from '@/utils/mongodb';
import { hash } from 'bcryptjs';
import { createDefaultOrganization } from '@/utils/organization';

export async function POST(req: Request) {
    try {
        const { email, password, name } = await req.json();
        const db = mongoClient.db();

        // Check if user exists
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { error: 'User already exists' },
                { status: 400 }
            );
        }

        // Create new user
        const hashedPassword = await hash(password, 12);
        const result = await db.collection('users').insertOne({
            email,
            password: hashedPassword,
            name,
            role: 'user',
            emailVerified: false,
            createdAt: new Date(),
        });

        // Create personal organization
        await createDefaultOrganization(result.insertedId.toString(), email);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Registration failed' },
            { status: 500 }
        );
    }
}
