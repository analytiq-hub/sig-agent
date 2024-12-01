import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import mongoClient from '@/utils/mongodb';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    const db = mongoClient.db();
    const users = db.collection('users');

    // Check if user exists
    const existingUser = await users.findOne({ email });

    if (existingUser) {
      // Never merge accounts automatically
      return NextResponse.json(
        { 
          error: 'An account with this email already exists. If this is your account, please sign in with your existing provider.',
          provider: existingUser.accounts?.[0]?.provider || 'password' 
        },
        { status: 400 }
      );
    }

    // Create new user
    const hashedPassword = await hash(password, 12);
    await users.insertOne({
      email,
      password: hashedPassword,
      name,
      emailVerified: false,
      verificationToken: crypto.randomUUID(),
      createdAt: new Date(),
    });

    // TODO: Send verification email
    
    return NextResponse.json({ 
      success: true,
      message: 'Please check your email to verify your account'
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
