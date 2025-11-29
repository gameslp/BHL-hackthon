import dotenv from 'dotenv';
import app from './app';

// Load .env from the backend package directory
// When running from packages/backend, .env is in the same directory
dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
});
