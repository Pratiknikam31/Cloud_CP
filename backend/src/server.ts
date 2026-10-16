// Local development entry point (npm run dev / npm start).
// On Vercel this file is NOT used: Vercel imports src/app.ts, which exports the
// Express app as its default export, and runs it as a Vercel Function.
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { assertRequiredEnv, ConfigError, env } from './config/env';

try {
  assertRequiredEnv();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`[Config] ${err.message}`);
    process.exit(1);
  }
  throw err;
}

const PORT = env.port();

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`[SmartHospital API] Server running on port ${PORT}`);
  console.log(`[Environment] Mode: ${env.nodeEnv()}`);
  console.log(`[DynamoDB] Table: ${env.tableName()}  Region: ${env.awsRegion()}${env.dynamoEndpoint() ? `  Endpoint: ${env.dynamoEndpoint()}` : ''}`);
  console.log(`[URL] http://localhost:${PORT}/api/health?db=1`);
  console.log(`=======================================================`);
});
