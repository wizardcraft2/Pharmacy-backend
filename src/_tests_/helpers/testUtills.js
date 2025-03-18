import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

export const generateObjectId = () => new mongoose.Types.ObjectId();

export const generateToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'test_secret',
    { expiresIn: '1h' }
  );
};

export const createTestData = async (model, data) => {
  return await model.create(data);
};

export const clearCollection = async (model) => {
  await model.deleteMany({});
};

export const getAuthHeader = (token) => ({
  Authorization: `Bearer ${token}`
});
