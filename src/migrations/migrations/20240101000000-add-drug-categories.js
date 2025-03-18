export const up = async (db, client) => {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      // Create categories collection
      await db.createCollection('categories');
      
      // Add default categories
      await db.collection('categories').insertMany([
        { name: 'Antibiotics', description: 'Medications that fight bacterial infections' },
        { name: 'Analgesics', description: 'Pain relieving medications' },
        { name: 'Antihypertensives', description: 'Medications for high blood pressure' },
        { name: 'Antidiabetics', description: 'Medications for diabetes management' }
      ]);

      // Add category field to existing drugs
      await db.collection('drugs').updateMany(
        {},
        { $set: { categories: [] } }
      );
    });
  } finally {
    await session.endSession();
  }
};

export const down = async (db, client) => {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      // Remove category field from drugs
      await db.collection('drugs').updateMany(
        {},
        { $unset: { categories: "" } }
      );

      // Drop categories collection
      await db.collection('categories').drop();
    });
  } finally {
    await session.endSession();
  }
}; 