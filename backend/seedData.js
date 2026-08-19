require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true }, password: String,
  phone: String, address: String, userType: String
}, { timestamps: { createdAt: true, updatedAt: false } });

const sellerSchema = new mongoose.Schema({
  businessName: String, ownerName: String, username: { type: String, unique: true },
  email: { type: String, unique: true }, password: String, phone: String,
  address: String, fssaiNumber: String, isVerified: Boolean, logoUrl: String
}, { timestamps: { createdAt: true, updatedAt: false } });

const dishSchema = new mongoose.Schema({
  sellerId: mongoose.Schema.Types.ObjectId, name: String, description: String,
  price: Number, category: String, type: String, prepTime: Number, rating: Number,
  image: String, isAvailable: Boolean
}, { timestamps: { createdAt: true, updatedAt: false } });

const orderSchema = new mongoose.Schema({
  customerId: mongoose.Schema.Types.ObjectId, sellerId: mongoose.Schema.Types.ObjectId,
  items: [{ dishId: mongoose.Schema.Types.ObjectId, name: String, price: Number, quantity: Number }],
  totalAmount: Number, deliveryAddress: String, paymentMethod: String, status: String,
  specialInstructions: String
}, { timestamps: { createdAt: true, updatedAt: false } });

const reviewSchema = new mongoose.Schema({
  orderId: mongoose.Schema.Types.ObjectId, sellerId: mongoose.Schema.Types.ObjectId,
  customerId: mongoose.Schema.Types.ObjectId, rating: Number, comment: String
}, { timestamps: { createdAt: true, updatedAt: false } });

const User = mongoose.model('User', userSchema);
const Seller = mongoose.model('Seller', sellerSchema);
const Dish = mongoose.model('Dish', dishSchema);
const Order = mongoose.model('Order', orderSchema);
const Review = mongoose.model('Review', reviewSchema);

async function upsert(Model, filter, data) {
  return Model.findOneAndUpdate(filter, { $set: data }, { new: true, upsert: true, setDefaultsOnInsert: true });
}

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from backend/.env');
  await mongoose.connect(process.env.MONGODB_URI);

  const password = await bcrypt.hash('Homeplate@123', 10);
  const customer = await upsert(User, { email: 'priya@example.com' }, {
    name: 'Priya', email: 'priya@example.com', password, phone: '9087645321',
    address: 'Erode', userType: 'customer'
  });

  const indhu = await upsert(Seller, { email: 'indhu@example.com' }, {
    businessName: "Indhu's Kitchen", ownerName: 'Indhu', username: 'indhu05',
    email: 'indhu@example.com', password, phone: '9876543210', address: 'Erode',
    fssaiNumber: 'FSN4qr34rafdmns', isVerified: false,
    logoUrl: '/uploads/imageFile-1762858089795.avif'
  });
  const velu = await upsert(Seller, { email: 'velu@example.com' }, {
    businessName: "Velu's Kitchen", ownerName: 'Velu', username: 'velu2',
    email: 'velu@example.com', password, phone: '9876543210', address: 'Erode',
    fssaiNumber: 'FSN4qr34rafdmns', isVerified: false,
    logoUrl: ''
  });
  const anitha = await upsert(Seller, { email: 'anitha@example.com' }, {
    businessName: "Anitha's Meals", ownerName: 'Anitha', username: 'anitha01',
    email: 'anitha@example.com', password, phone: '9876543211', address: 'Erode',
    fssaiNumber: 'FSN4qr34rafdmaa', isVerified: true, logoUrl: ''
  });

  const dishes = [
    [indhu, 'Chicken Biryani', 'Authentic Dindugal biryani', 200, 'main-course', 'non-veg', 57, 'biryani.jpg'],
    [indhu, 'Ghee Roast', 'Crispy Ghee Roast with 3 chutneys', 30, 'main-course', 'veg', 30, 'Millet dosa.webp'],
    [indhu, 'Idly', 'Soft steamed idlies with sambar', 40, 'appetizer', 'veg', 15, 'idly.webp'],
    [indhu, 'Filter Coffee', 'Fresh South Indian filter coffee', 25, 'beverage', 'veg', 10, 'Coffee.webp'],
    [velu, 'Millet Dosa', 'Healthy millet dosa with chutney', 60, 'main-course', 'veg', 25, 'Millet dosa.webp'],
    [velu, 'Mini Meals', 'Rice, sambar, rasam and sides', 120, 'main-course', 'veg', 35, 'Mini meals.webp'],
    [velu, 'Ragi Kali', 'Traditional ragi kali meal', 70, 'main-course', 'veg', 25, 'kali.webp'],
    [anitha, 'Veg Biryani', 'Fragrant vegetable biryani', 140, 'main-course', 'veg', 40, 'imageFile-1766502695192.jpeg'],
    [anitha, 'Chocolate Dessert', 'A sweet finishing treat', 80, 'dessert', 'veg', 15, 'imageFile-1761239246270.png']
  ];

  const savedDishes = [];
  for (const [seller, name, description, price, category, type, prepTime, image] of dishes) {
    savedDishes.push(await upsert(Dish, { sellerId: seller._id, name }, {
      sellerId: seller._id, name, description, price, category, type, prepTime,
      rating: 4, image: `/uploads/${image}`, isAvailable: true
    }));
  }

  const biryani = savedDishes[0];
  const order = await upsert(Order, { customerId: customer._id, sellerId: indhu._id, totalAmount: 1000 }, {
    customerId: customer._id, sellerId: indhu._id,
    items: [{ dishId: biryani._id, name: biryani.name, price: biryani.price, quantity: 5 }],
    totalAmount: 1000, deliveryAddress: 'Erode', paymentMethod: 'cod', status: 'delivered', specialInstructions: ''
  });
  await upsert(Review, { orderId: order._id }, {
    orderId: order._id, sellerId: indhu._id, customerId: customer._id,
    rating: 4, comment: 'Tasty food and quick delivery.'
  });

  console.log('Seed complete: users, sellers, dishes, orders and reviews are ready.');
}

seed().catch(error => { console.error('Seed failed:', error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
