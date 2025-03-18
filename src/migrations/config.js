import path from 'path';

export default {
  mongodb: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy-wiki',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  migrationsDir: path.resolve(__dirname, './migrations'),
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  useFileHash: false
}; 