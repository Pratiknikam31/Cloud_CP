import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`[SmartHospital API] Server running on port ${PORT}`);
    console.log(`[Environment] Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[URL] http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
};

startServer();
