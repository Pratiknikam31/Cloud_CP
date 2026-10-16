import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

// Single source of truth for the DynamoDB table layout.
// SETUP.md describes exactly this definition for the AWS Console, and
// `npm run db:create-table` creates it programmatically (local / test use).
//
//   Table  HospitalData   PK (String, partition key)  SK (String, sort key)
//   GSI1   GSI1PK / GSI1SK  "list by type"      e.g. TYPE#APPT   / 2026-10-17T09:00:00.000Z#<id>
//   GSI2   GSI2PK / GSI2SK  "by patient/owner"  e.g. PATIENT#<id> / APPT#2026-10-17...#<id>
//   GSI3   GSI3PK / GSI3SK  "by doctor/user"    e.g. DOCTOR#<id>  / APPT#2026-10-17...#<id>
// All GSIs project ALL attributes. Billing mode: on-demand (PAY_PER_REQUEST).

export const INDEXES = {
  GSI1: { pk: 'GSI1PK', sk: 'GSI1SK' },
  GSI2: { pk: 'GSI2PK', sk: 'GSI2SK' },
  GSI3: { pk: 'GSI3PK', sk: 'GSI3SK' },
} as const;

export type IndexName = keyof typeof INDEXES;

export const KEY_ATTRIBUTES = ['PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK'] as const;

export const buildCreateTableInput = (tableName: string): CreateTableCommandInput => ({
  TableName: tableName,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: KEY_ATTRIBUTES.map((name) => ({ AttributeName: name, AttributeType: 'S' })),
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  GlobalSecondaryIndexes: (Object.keys(INDEXES) as IndexName[]).map((name) => ({
    IndexName: name,
    KeySchema: [
      { AttributeName: INDEXES[name].pk, KeyType: 'HASH' },
      { AttributeName: INDEXES[name].sk, KeyType: 'RANGE' },
    ],
    Projection: { ProjectionType: 'ALL' },
  })),
});
