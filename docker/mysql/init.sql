-- Create shadow database for Prisma migrations
CREATE DATABASE IF NOT EXISTS shadow_db;

-- Grant privileges to app user
GRANT ALL PRIVILEGES ON shadow_db.* TO 'appuser'@'%';
GRANT ALL PRIVILEGES ON appdb.* TO 'appuser'@'%';

FLUSH PRIVILEGES;
