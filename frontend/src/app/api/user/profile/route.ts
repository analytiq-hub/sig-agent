import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import mongoClient from '@/utils/mongodb';

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  const { name } = await request.json();
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db();
    
    await db.collection('users').updateOne(
      { email: session.user?.email },
      { $set: { name: name } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user name:', error);
    return new NextResponse(null, { status: 500 });
  }
} 