import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import mongoClient from '@/utils/mongodb';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = mongoClient.db();
    const workspacesCollection = db.collection('workspaces');

    // Check if user has any workspaces
    let workspaces = await workspacesCollection
      .find({
        'members.userId': session.user.id
      })
      .toArray();

    // If no workspaces exist for the user, create a default one
    if (workspaces.length === 0) {
      const defaultWorkspace = {
        name: 'Personal Workspace',
        slug: `personal-${session.user.id}`,
        ownerId: session.user.id,
        members: [{
          userId: session.user.id,
          role: 'owner' as const,
          email: session.user.email,
          name: session.user.name
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await workspacesCollection.insertOne(defaultWorkspace);
      workspaces = [{
        ...defaultWorkspace,
        _id: result.insertedId
      }];
    }

    // Transform _id to id for frontend consumption
    const transformedWorkspaces = workspaces.map(workspace => ({
      ...workspace,
      id: workspace._id.toString(),
      _id: undefined
    }));

    console.log('Returning workspaces:', transformedWorkspaces);
    return NextResponse.json({ workspaces: transformedWorkspaces });

  } catch (error) {
    console.error('Error in workspaces GET:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    const db = mongoClient.db();
    
    // Check if slug is unique
    const existing = await db.collection('workspaces').findOne({ slug });
    if (existing) {
      return NextResponse.json(
        { error: 'Workspace with this slug already exists' },
        { status: 400 }
      );
    }
    
    const workspace = {
      name,
      slug,
      ownerId: session.user.id,
      members: [{
        userId: session.user.id,
        role: 'owner' as const,
        email: session.user.email,
        name: session.user.name
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('workspaces').insertOne(workspace);
    const createdWorkspace = {
      ...workspace,
      id: result.insertedId.toString()
    };

    return NextResponse.json({ workspace: createdWorkspace });
  } catch (error) {
    console.error('Error in workspaces POST:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
} 