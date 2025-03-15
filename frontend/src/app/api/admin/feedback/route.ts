import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import clientPromise from '@/utils/mongodb';

export async function GET() {
    
  try {
    const session = await getServerSession(authOptions);
    
    // Debug the session object to see what's available
    console.log("[NEXTJS] Complete Session:", JSON.stringify(session, null, 2));
    
    const isAdmin = session?.user?.role === 'admin';
    
    // Check if user is authenticated and is an admin
    if (!session || !isAdmin) {
      console.log("[NEXTJS] Auth check failed - Session exists:", !!session, "Role:", session?.user?.role);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Connect to database
    const client = await clientPromise;
    const db = client.db();
    
    // Fetch feedback entries, sorted by creation date (newest first)
    const feedbackEntries = await db.collection('feedback')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    return NextResponse.json(
      { feedback: feedbackEntries },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
} 