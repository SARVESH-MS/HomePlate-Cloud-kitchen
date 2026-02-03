// server.js - Backend Server for Home Plate Cloud Kitchen
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- OpenAI Configuration ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Multer Configuration for File Uploads ---
const uploadDir = 'uploads';
// Ensure 'uploads' directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer disk storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save files to 'uploads' folder
  },
  filename: (req, file, cb) => {
    // Create a unique filename
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage });

// --- Serve Uploaded Files Statically ---
// This makes http://localhost:5000/uploads/filename.jpg work
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/homeplate', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// ============= SCHEMAS =============

// User Schema (Unchanged)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  address: String,
  userType: { type: String, enum: ['customer', 'seller'], required: true },
  createdAt: { type: Date, default: Date.now }
});

// --- Seller Schema (UPDATED) ---
const sellerSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  ownerName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  fssaiNumber: String,
  isVerified: { type: Boolean, default: false },
  logoUrl: { type: String, default: '' }, // <-- NEW: For seller logo
  createdAt: { type: Date, default: Date.now }
});

// Dish Schema (Unchanged)
const dishSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: { type: String, enum: ['appetizer', 'main-course', 'dessert', 'beverage'], required: true },
  type: { type: String, enum: ['veg', 'non-veg'], required: true },
  prepTime: Number,
  rating: { type: Number, default: 4.0 },
  image: String,
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Order Schema (Unchanged)
const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  items: [{
    dishId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dish' },
    name: String,
    price: Number,
    quantity: Number
  }],
  totalAmount: { type: Number, required: true },
  deliveryAddress: { type: String, required: true },
  paymentMethod: { type: String, enum: ['cod', 'online'], required: true },
  status: { type: String, enum: ['new', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'], default: 'new' },
  specialInstructions: String,
  createdAt: { type: Date, default: Date.now }
});

// --- Review Schema (NEW) ---
const reviewSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Seller = mongoose.model('Seller', sellerSchema);
const Dish = mongoose.model('Dish', dishSchema);
const Order = mongoose.model('Order', orderSchema);
const Review = mongoose.model('Review', reviewSchema); // <-- NEW

// ============= MIDDLEWARE =============

// Authentication Middleware (Unchanged)
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
    req.userType = decoded.userType;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// ============= AI RECOMMENDATION ENGINE =============
// (Unchanged)
const getAIRecommendations = async (userId, cartItems) => {
  try {
    const recommendations = [];
    
    // Get user's order history
    const userOrders = await Order.find({ customerId: userId }).limit(10);
    
    // Analyze cart items
    const hasNonVeg = cartItems.some(item => item.type === 'non-veg');
    const cartCategories = cartItems.map(item => item.category);
    
    // Recommendation 1: Complementary items
    if (hasNonVeg) {
      const breads = await Dish.find({ 
        category: 'main-course', 
        type: 'veg',
        name: { $regex: /chapati|naan|roti/i }
      }).limit(3);
      
      if (breads.length > 0) {
        recommendations.push({
          reason: "🍞 Perfect pairing with your non-veg selection",
          dishes: breads
        });
      }
    }
    
    // Recommendation 2: Popular items
    const popularDishes = await Dish.find({ isAvailable: true })
      .sort({ rating: -1 })
      .limit(3);
    
    recommendations.push({
      reason: "⭐ Top rated dishes",
      dishes: popularDishes
    });
    
    // Recommendation 3: Similar category items
    if (cartCategories.length > 0) {
      const similarDishes = await Dish.find({
        category: { $in: cartCategories },
        isAvailable: true
      }).limit(3);
      
      if (similarDishes.length > 0) {
        recommendations.push({
          reason: "🔥 You might also like",
          dishes: similarDishes
        });
      }
    }
    
    // Recommendation 4: Based on order history
    if (userOrders.length > 0) {
      const orderedDishIds = userOrders.flatMap(order => 
        order.items.map(item => item.dishId)
      );
      
      const historyBasedDishes = await Dish.find({
        _id: { $in: orderedDishIds },
        isAvailable: true
      }).limit(3);
      
      if (historyBasedDishes.length > 0) {
        recommendations.push({
          reason: "📋 Based on your order history",
          dishes: historyBasedDishes
        });
      }
    }
    
    return recommendations;
  } catch (error) {
    console.error('AI Recommendation Error:', error);
    return [];
  }
};

// ============= ROUTES =============

// Customer Registration (Unchanged)
app.post('/api/customer/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      userType: 'customer'
    });
    
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id, userType: 'customer' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({ 
      message: 'Customer registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer Login (Unchanged)
app.post('/api/customer/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email, userType: 'customer' });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user._id, userType: 'customer' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.json({ 
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seller Registration (Unchanged)
app.post('/api/seller/register', async (req, res) => {
  try {
    const { businessName, ownerName, username, email, password, phone, address, fssaiNumber } = req.body;
    
    const existingSeller = await Seller.findOne({ $or: [{ email }, { username }] });
    if (existingSeller) {
      return res.status(400).json({ error: 'Email or username already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const seller = new Seller({
      businessName,
      ownerName,
      username,
      email,
      password: hashedPassword,
      phone,
      address,
      fssaiNumber
    });
    
    await seller.save();
    
    res.status(201).json({ 
      message: 'Seller registered successfully. Please wait for verification.',
      seller: { id: seller._id, businessName: seller.businessName }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seller Login (Unchanged)
app.post('/api/seller/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const seller = await Seller.findOne({ username });
    if (!seller) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, seller.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: seller._id, userType: 'seller' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.json({ 
      message: 'Login successful',
      token,
      seller: { id: seller._id, businessName: seller.businessName, name: seller.businessName }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Add Seller Logo (NEW) ---
app.patch('/api/seller/logo', authMiddleware, upload.single('logoFile'), async (req, res) => {
  try {
    if (req.userType !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can update their logo' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Logo file is required.' });
    }

    const logoUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;

    const seller = await Seller.findByIdAndUpdate(
      req.userId,
      { logoUrl: logoUrl },
      { new: true }
    );

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found.' });
    }

    res.json({ message: 'Logo updated successfully', seller });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Dishes (Unchanged)
app.get('/api/dishes', async (req, res) => {
  try {
    const { type, category, search } = req.query;
    let query = { isAvailable: true };
    
    if (type) query.type = type;
    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };
    
    const dishes = await Dish.find(query).populate('sellerId', 'businessName');
    res.json(dishes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Add Dish (UPDATED for File Upload) ---
app.post('/api/dishes', authMiddleware, upload.single('imageFile'), async (req, res) => {
  try {
    if (req.userType !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can add dishes' });
    }

    // req.file is the 'imageFile'
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required.' });
    }

    // Construct the public URL for the image
    // Make sure PORT is defined (it's at the bottom, so we'll move it up or hardcode)
    const PORT = process.env.PORT || 5000;
    const imageUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    
    // Data from the form is in req.body
    const { name, description, price, category, type, prepTime } = req.body;
    
    const dish = new Dish({
      sellerId: req.userId,
      name,
      description,
      price: Number(price), // Ensure price is a number
      category,
      type,
      prepTime: Number(prepTime), // Ensure prepTime is a number
      image: imageUrl // Save the URL to the database
    });
    
    await dish.save();
    res.status(201).json({ message: 'Dish added successfully', dish });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Seller's Dishes (Unchanged)
app.get('/api/seller/dishes', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'seller') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const dishes = await Dish.find({ sellerId: req.userId });
    res.json(dishes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Order (Unchanged)
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'customer') {
      return res.status(403).json({ error: 'Only customers can place orders' });
    }
    
    const { items, totalAmount, deliveryAddress, paymentMethod, specialInstructions, sellerId } = req.body;
    
    const order = new Order({
      customerId: req.userId,
      sellerId,
      items,
      totalAmount,
      deliveryAddress,
      paymentMethod,
      specialInstructions
    });
    
    await order.save();
    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Customer Orders (Unchanged)
app.get('/api/customer/orders', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'customer') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const orders = await Order.find({ customerId: req.userId })
      .populate('items.dishId')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Seller Orders (Unchanged)
app.get('/api/seller/orders', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'seller') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const orders = await Order.find({ sellerId: req.userId })
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Order Status (Unchanged)
app.patch('/api/orders/:orderId/status', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can update order status' });
    }
    
    const { orderId } = req.params;
    const { status } = req.body;
    
    const order = await Order.findOneAndUpdate(
      { _id: orderId, sellerId: req.userId },
      { status },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ message: 'Order status updated', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Recommendations (Unchanged)
app.post('/api/recommendations', authMiddleware, async (req, res) => {
  try {
    const { cartItems } = req.body;
    const recommendations = await getAIRecommendations(req.userId, cartItems || []);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seller Dashboard Stats (Unchanged)
app.get('/api/seller/stats', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'seller') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const totalOrders = await Order.countDocuments({ sellerId: req.userId });
    const totalDishes = await Dish.countDocuments({ sellerId: req.userId });
    
    const orders = await Order.find({ sellerId: req.userId });
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    
    // --- THIS IS A SIMPLE AVG RATING ---
    // For a more accurate rating, you should average the new 'Review' collection
    const dishes = await Dish.find({ sellerId: req.userId });
    const avgRating = dishes.length > 0 
      ? dishes.reduce((sum, dish) => sum + dish.rating, 0) / dishes.length 
      : 0;
    
    res.json({
      totalOrders,
      totalDishes,
      totalRevenue,
      avgRating: avgRating.toFixed(1)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Add Review (NEW) ---
app.post('/api/reviews', authMiddleware, async (req, res) => {
    try {
        if (req.userType !== 'customer') {
            return res.status(403).json({ error: 'Only customers can write reviews' });
        }
        
        const { orderId, sellerId, rating, comment } = req.body;

        // Check if review already exists for this order
        const existingReview = await Review.findOne({ orderId: orderId, customerId: req.userId });
        if (existingReview) {
            return res.status(400).json({ error: 'You have already reviewed this order.' });
        }

        const review = new Review({
            orderId,
            sellerId,
            customerId: req.userId,
            rating,
            comment
        });

        await review.save();

        // TODO: You could also trigger an update to the Seller's average rating here

        res.status(201).json({ message: 'Review submitted successfully', review });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Get Seller Reviews (NEW) ---
app.get('/api/seller/:sellerId/reviews', async (req, res) => {
    try {
        const { sellerId } = req.params;
        const reviews = await Review.find({ sellerId: sellerId })
            .populate('customerId', 'name') // Get just the customer's name
            .sort({ createdAt: -1 });
        
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- Chatbot Route (NEW) ---
app.post('/api/chatbot', authMiddleware, async (req, res) => {
    try {
        const { message } = req.body;

        const systemPrompt = "You are a helpful assistant for a food delivery app called 'Home Plate'. You answer questions for both customers and sellers. Keep your answers concise, friendly, and helpful. For customers, you can answer questions about orders or food. For sellers, you can answer questions about managing their menu or orders.";

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ]
        });

        res.json({ reply: completion.choices[0].message.content });
    } catch (error) {
        console.error('OpenAI Error:', error.message);
        res.status(500).json({ error: 'Failed to get response from AI assistant.' });
    }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Uploaded images available at http://localhost:${PORT}/uploads`);
});