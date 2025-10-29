import { NextResponse } from 'next/server';
import { getDatabase } from '@/utils/mongodb';
import { hash } from 'bcryptjs';
import { SigAgentAccountApi } from '@/utils/api';

export async function POST(req: Request) {
    try {
        const { email, password, name } = await req.json();
        const db = getDatabase();

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
            email_verified: false,
            created_at: new Date(),
        });

        // Send verification email using the new endpoint
        const sigAgentAccountApi = new SigAgentAccountApi();
        await sigAgentAccountApi.sendRegistrationVerificationEmail(result.insertedId.toString());

        return NextResponse.json({ 
            success: true,
            message: 'Registration successful. Please check your email to verify your account.'
        });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Registration failed' },
            { status: 500 }
        );
    }
}
