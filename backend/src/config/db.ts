import mongoose from 'mongoose';

export const connectDB = async () => {
  const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smarthospital';

  console.log(`[MongoDB] Attempting connection to: ${connStr.replace(/\/\/.*@/, '//<credentials>@')}`);

  try {
    const conn = await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 10000,
    });

    try {
      const usersCollection = conn.connection.collection('users');
      const userIndexes = await usersCollection.indexes();
      if (userIndexes.some((index) => index.name === 'username_1')) {
        await usersCollection.dropIndex('username_1');
        console.log('[MongoDB] Removed obsolete users.username index');
      }
    } catch (error: any) {
      if (error.code !== 26) throw error;
    }

    console.log(`[MongoDB] ✅ Connected successfully: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`[MongoDB] ❌ CONNECTION FAILED: ${error.message}`);
    console.error(`[MongoDB] Please check your MONGODB_URI in .env`);
    console.error(`[MongoDB] If using Atlas, ensure:`);
    console.error(`  1. Your cluster URL is correct (not 'your-cluster')`);
    console.error(`  2. Your IP address is whitelisted in Atlas Network Access`);
    console.error(`  3. Username and password are correct`);
    process.exit(1); // Exit instead of silently continuing
  }
};
