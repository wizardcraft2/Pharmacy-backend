import express from 'express';
import http from 'http';

import mongoose from 'mongoose';
import morgan from 'morgan';
import cors from 'cors';
import homeRouter from './routes/home.js';
import tradesRouter from './routes/trande_names.js';
import ingredientsRouter from './routes/ingredients.js';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// MongoDB connection with retry logic
const connectDB = async () => {
  console.log(process.env.MONGODB_URI)
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/drugs');
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.log(error)
  }
};

await connectDB();
app.use('/home/', homeRouter);
app.use('/trade-names', tradesRouter);
app.use('/ingredients', ingredientsRouter);
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});

export default app;
