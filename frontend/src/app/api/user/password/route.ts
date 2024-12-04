import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import mongoClient from '@/utils/mongodb';
import { compare, hash } from 'bcryptjs';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { oldPassword, newPassword } = await req.json();

        if (!oldPassword || !newPassword) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const db = mongoClient.db();
        const user = await db.collection('users').findOne({ email: session.user.email });

        if (!user || !user.password) {
            return NextResponse.json({ error: 'User not found or no password set' }, { status: 404 });
        }

        // Verify old password
        const isValid = await compare(oldPassword, user.password);
        if (!isValid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
        }

        // Hash and update new password
        const hashedPassword = await hash(newPassword, 12);
        await db.collection('users').updateOne(
            { _id: new ObjectId(user._id) },
            { $set: { password: hashedPassword } }
        );

        return NextResponse.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 