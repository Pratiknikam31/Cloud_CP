import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';
import { env } from './env';

// All AWS access happens here, on the server. Credentials are resolved in this order:
//  1. DYNAMODB_ENDPOINT set (DynamoDB Local for tests) -> static dummy credentials, never sent to AWS.
//  2. AWS_ROLE_ARN set (Vercel) -> short-lived credentials via Vercel OIDC + STS AssumeRoleWithWebIdentity.
//  3. Otherwise -> the standard AWS SDK provider chain: AWS_PROFILE / IAM Identity Center (SSO),
//     AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, shared credentials file, etc.
const resolveCredentials = () => {
  if (env.dynamoEndpoint()) {
    return { accessKeyId: 'local', secretAccessKey: 'local' };
  }
  const roleArn = env.awsRoleArn();
  if (roleArn) {
    return awsCredentialsProvider({ roleArn, roleSessionName: 'hospital-api' });
  }
  return undefined;
};

let documentClient: DynamoDBDocumentClient | undefined;

// The client is created once per function instance and reused across requests.
export const getDocumentClient = (): DynamoDBDocumentClient => {
  if (!documentClient) {
    const client = new DynamoDBClient({
      region: env.awsRegion(),
      endpoint: env.dynamoEndpoint(),
      credentials: resolveCredentials(),
      maxAttempts: 3,
    });
    documentClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: false },
    });
  }
  return documentClient;
};

// Test helper: forget the cached client (e.g. after changing env vars).
export const resetDocumentClient = () => {
  documentClient = undefined;
};
