import { db } from '../index';
import { cacheFileTable } from '../schema';

db.delete(cacheFileTable)
  .then(() => {
    console.log('✅ File cache cleared successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  });
