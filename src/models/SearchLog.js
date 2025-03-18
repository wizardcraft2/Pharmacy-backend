import mongoose from 'mongoose';

const searchLogSchema = new mongoose.Schema({
  query: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['drug', 'manufacturer', 'ingredient', 'all'],
    default: 'all'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('SearchLog', searchLogSchema);