# Install instructions for Ubuntu server

* Server requirements: 500G disk, at least 4x CPU, at least 4G RAM
* Install `Docker, git, make`.
* Clone sandbox `https://github.com/analytiq-hub/doc-router`
* Create a `.env` file at the root based on `.env.example`
  * You will update `.env` with the Mongo, LLM, AWS settings below
  * Then, you run `make deploy` from the top of the sandbox.

* Install Mongo locally. Enable user/password access. 
  * Mongo URI will be of the form `mongodb://admin:<pw>@<ip>:27017/?authSource=admin`
* Create Google Gemini and OpenAI tokens

## AWS Setup

### Step 1: Create S3 Bucket

1. **Log into AWS Console** and navigate to S3
2. **Click "Create bucket"**
3. **Configure bucket settings:**
   - **Bucket name**: Choose a unique name (e.g., `my-company-docrouter-data`)
   - **Region**: Select your preferred region (e.g., `us-east-1`)
   - **Block Public Access**: Keep all blocks enabled (recommended)
   - **Bucket Versioning**: Enable if needed for compliance
   - **Default encryption**: Enable server-side encryption (recommended)
4. **Click "Create bucket"**

### Step 2: Create IAM User and Credentials

1. **Navigate to IAM** in AWS Console
2. **Click "Users" → "Create user"**
3. **User details:**
   - **User name**: `docrouter-app-user` (or your preferred name)
   - **Access type**: Select "Programmatic access"
4. **Click "Next: Permissions"**

5. **Create a custom policy** with these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR-BUCKET-NAME",
                "arn:aws:s3:::YOUR-BUCKET-NAME/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "textract:StartDocumentAnalysis",
                "textract:GetDocumentAnalysis",
                "textract:StartDocumentTextDetection",
                "textract:GetDocumentTextDetection"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "sts:GetCallerIdentity",
                "sts:AssumeRole"
            ],
            "Resource": "*"
        }
    ]
}
```

6. **Save the policy** as `DocRouterPolicy` and attach it to your IAM user
7. **Generate access keys**:
   - Go to "Security credentials" tab
   - Click "Create access key"
   - Select "Application running outside AWS"
   - Download the CSV file or copy the credentials:
     - **Access Key ID**: 20 characters (e.g., `AKIAIOSFODNN7EXAMPLE`)
     - **Secret Access Key**: 40 characters (e.g., `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)

⚠️ **Important**: Store these credentials securely - you won't be able to see the secret key again!

### Step 3: Configure Environment Variables

Add these variables to your `.env` file:

```bash
# AWS Configuration
AWS_S3_BUCKET_NAME=your-bucket-name-here
AWS_ACCESS_KEY_ID=your-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here

# Other required variables
MONGODB_URI=mongodb://admin:<pw>@<ip>:27017/?authSource=admin
NEXTAUTH_SECRET=your-secret-key-here
ENV=prod
```

### Step 4: Verify Setup

**Check DocRoouter application logs** for:
   - ✅ `"AWS client created successfully"`
   - ❌ `"AWS credentials are not correct"` (if there's an issue)

### Troubleshooting

**Common Issues:**
- "AWS credentials are not correct": Verify key formats and permissions
- "Access Denied": Check bucket permissions and IAM policies
- Textract errors: Verify Textract permissions and document formats

For detailed troubleshooting, check AWS CloudTrail logs and application logs.
  

