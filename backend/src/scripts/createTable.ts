import dotenv from 'dotenv';
dotenv.config();

import { CreateTableCommand, DescribeTableCommand, DynamoDBClient, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
import { env } from '../config/env';
import { buildCreateTableInput } from '../db/table';

// Creates the HospitalData table with its three GSIs (on-demand billing).
// Intended for DynamoDB Local and tests; for real AWS you can use this or follow
// the AWS Console steps in SETUP.md (both produce the same definition).
// Requires dynamodb:CreateTable / DescribeTable, which the application's runtime
// IAM policy intentionally does NOT include, so run it with an admin identity.
const main = async () => {
  const client = new DynamoDBClient({
    region: env.awsRegion(),
    endpoint: env.dynamoEndpoint(),
    ...(env.dynamoEndpoint() ? { credentials: { accessKeyId: 'local', secretAccessKey: 'local' } } : {}),
  });
  const TableName = env.tableName();

  try {
    const existing = await client.send(new DescribeTableCommand({ TableName }));
    console.log(`Table ${TableName} already exists (status: ${existing.Table?.TableStatus}). Nothing to do.`);
    return;
  } catch (err: any) {
    if (err?.name !== 'ResourceNotFoundException') throw err;
  }

  console.log(`Creating table ${TableName} in ${env.awsRegion()}${env.dynamoEndpoint() ? ` (endpoint ${env.dynamoEndpoint()})` : ''}...`);
  await client.send(new CreateTableCommand(buildCreateTableInput(TableName)));
  await waitUntilTableExists({ client, maxWaitTime: 300 }, { TableName });
  console.log(`Table ${TableName} is ACTIVE.`);
};

main().catch((err) => {
  console.error('Failed to create table:', err.name, err.message);
  process.exit(1);
});
