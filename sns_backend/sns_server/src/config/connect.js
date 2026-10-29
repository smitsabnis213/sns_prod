import mongoose from "mongoose";

export const connectDB = async (uri = process.env.MONGO_URI) => {
  if (!uri) throw new Error("MONGO_URI is required to start the Buddyyaa API.");
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected.");
  } catch (error) {
    throw new Error("MongoDB connection failed.", { cause: error });
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};

export const getMongoStatus = () => ({
  connected: mongoose.connection.readyState === 1,
  state: mongoose.connection.readyState,
});
