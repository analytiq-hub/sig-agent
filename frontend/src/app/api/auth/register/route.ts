import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import mongoClient from '@/utils/mongodb';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Get database instance
    const db = mongoClient.db();
    const users = db.collection('users');

    // Check if user exists
    const existingUser = await users.findOne({ email });

    if (existingUser) {
      // If user exists and has password, they're already registered
      if (existingUser.password) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 400 }
        );
      }

      // If user exists without password (OAuth), merge accounts
      const hashedPassword = await hash(password, 12);
      await users.updateOne(
        { email },
        { 
          $set: {
            password: hashedPassword,
            name: name,
            emailVerified: false,
            verificationToken: crypto.randomUUID(),
          }
        }
      );
    } else {
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
    }

    // TODO: Send verification email
    // Implement email sending logic here
    
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
