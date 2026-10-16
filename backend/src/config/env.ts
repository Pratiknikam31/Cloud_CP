// Central place for reading environment variables.
// Values are read lazily (at call time) so the same code works with dotenv
// locally and with Vercel's injected environment in production.

const read = (name: string): string | undefined => {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const required = (name: string): string => {
  const value = read(name);
  if (!value) {
    throw new ConfigError(`Missing required environment variable ${name}. See backend/.env.example and SETUP.md.`);
  }
  return value;
};

export const env = {
  nodeEnv: () => read('NODE_ENV') || 'development',
  port: () => Number(read('PORT') || 5000),

  // Comma-separated list of allowed browser origins for CORS.
  clientUrls: () =>
    (read('CLIENT_URL') || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),

  jwtSecret: () => required('JWT_SECRET'),
  jwtExpiresIn: () => read('JWT_EXPIRES_IN') || '7d',

  awsRegion: () => required('AWS_REGION'),
  tableName: () => read('DYNAMODB_TABLE_NAME') || 'HospitalData',
  // Optional: point the SDK at DynamoDB Local (e.g. http://localhost:8000) for tests.
  dynamoEndpoint: () => read('DYNAMODB_ENDPOINT'),
  // Optional: IAM role assumed through Vercel OIDC federation (production on Vercel).
  awsRoleArn: () => read('AWS_ROLE_ARN'),
};

// Called once at local server start-up so misconfiguration fails fast with a clear message.
export const assertRequiredEnv = () => {
  env.jwtSecret();
  env.awsRegion();
};
