import mongoose from 'mongoose';

const manufacturerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  description: String,
  country: String,
  website: String,
  authorizedSellers: [{
    name: String,
    url: String,
    verified: Boolean
  }],
  meta: {
    keywords: [String]
  }
});

export default mongoose.model('Manufacturer', manufacturerSchema); 