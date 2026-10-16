import { CreateTableCommand, DeleteTableCommand, DynamoDBClient, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
import { buildCreateTableInput } from '../../src/db/table';
import { resetDocumentClient } from '../../src/config/aws';

// Integration tests run against DynamoDB Local (no AWS account needed):
//   docker run -p 8000:8000 amazon/dynamodb-local   (or the DynamoDB Local JAR)
// Each test file gets its own temporary table, deleted afterwards.
// Set DYNAMODB_ENDPOINT to override the default http://localhost:8000.

export const LOCAL_ENDPOINT = process.env.DYNAMODB_TEST_ENDPOINT || 'http://localhost:8000';

const client = () =>
  new DynamoDBClient({
    region: 'us-east-1',
    endpoint: LOCAL_ENDPOINT,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });

export const isDynamoLocalAvailable = async (): Promise<boolean> => {
  try {
    const res = await fetch(LOCAL_ENDPOINT, { method: 'GET' });
    return res.status > 0;
  } catch {
    return false;
  }
};

export const setupTestTable = async (): Promise<string> => {
  const tableName = `HospitalData-test-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  process.env.AWS_REGION = 'us-east-1';
  process.env.DYNAMODB_ENDPOINT = LOCAL_ENDPOINT;
  process.env.DYNAMODB_TABLE_NAME = tableName;
  process.env.JWT_SECRET = 'test-only-jwt-secret-not-for-production';
  process.env.NODE_ENV = 'test';
  delete process.env.AWS_ROLE_ARN;
  resetDocumentClient();
  const c = client();
  await c.send(new CreateTableCommand(buildCreateTableInput(tableName)));
  await waitUntilTableExists({ client: c, maxWaitTime: 60 }, { TableName: tableName });
  return tableName;
};

export const teardownTestTable = async (tableName: string) => {
  try {
    await client().send(new DeleteTableCommand({ TableName: tableName }));
  } catch {
    // ignore
  }
};
