import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next"
import { Session } from 'next-auth';
import { authOptions } from '@/auth';
import mongoClient from '@/utils/mongodb';

export async function DELETE() {
    try {
        const session = await getServerSession(authOptions) as Session;
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = mongoClient.db();
        
        // Delete user and related data
        await db.collection('users').deleteOne({ email: session.user.email });
        await db.collection('accounts').deleteMany({ userId: session.user.email });
        await db.collection('sessions').deleteMany({ userId: session.user.email });

        return NextResponse.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Account deletion error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 