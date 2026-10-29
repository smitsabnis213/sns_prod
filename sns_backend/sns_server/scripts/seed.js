import "dotenv/config";
import { connectDB, disconnectDB } from "../src/config/connect.js";
import Category from "../src/models/category.js";
import Product from "../src/models/products.js";

const seeds = [
  {
    category: { name: "Fruits", image: "https://placehold.co/600x400?text=Fruits" },
    products: [
      { name: "Banana", image: "https://placehold.co/600x400?text=Banana", price: 40, quantity: "1 dozen" },
      { name: "Apple", image: "https://placehold.co/600x400?text=Apple", price: 120, quantity: "1 kg" },
    ],
  },
  {
    category: { name: "Vegetables", image: "https://placehold.co/600x400?text=Vegetables" },
    products: [
      { name: "Potato", image: "https://placehold.co/600x400?text=Potato", price: 30, quantity: "1 kg" },
      { name: "Tomato", image: "https://placehold.co/600x400?text=Tomato", price: 35, quantity: "1 kg" },
    ],
  },
  {
    category: { name: "Dairy", image: "https://placehold.co/600x400?text=Dairy" },
    products: [
      { name: "Milk", image: "https://placehold.co/600x400?text=Milk", price: 50, quantity: "1 L" },
    ],
  },
];

try {
  await connectDB();
  for (const { category: categoryData, products } of seeds) {
    const category = await Category.findOneAndUpdate(
      { name: categoryData.name },
      { $setOnInsert: categoryData },
      { new: true, upsert: true, runValidators: true }
    );
    for (const productData of products) {
      await Product.updateOne(
        { name: productData.name, category: category._id },
        { $setOnInsert: { ...productData, category: category._id, isActive: true } },
        { upsert: true, runValidators: true }
      );
    }
  }
  console.log("Buddyyaa sample categories and products seeded without overwriting existing records.");
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
