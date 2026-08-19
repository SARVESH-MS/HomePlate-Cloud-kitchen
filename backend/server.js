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
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(origin => origin.trim());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  }
}));
app.use(express.json({ limit: '1mb' }));

// --- OpenAI Configuration ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Multer Configuration for File Uploads ---
const uploadDir = path.join(__dirname, 'uploads');
// Ensure 'uploads' directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer disk storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return callback(null, true);
    return callback(new Error('Only image files are allowed.'));
  }
});

// --- Serve Uploaded Files Statically ---
// This makes http://localhost:5000/uploads/filename.jpg work
app.use('/uploads', express.static(uploadDir));

const publicFileUrl = (req, filename) => {
  const baseUrl = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return `${baseUrl}/uploads/${filename}`;
};

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
  deliveryPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPerson', default: null },
  deliveryLocation: {
    latitude: Number,
    longitude: Number,
    updatedAt: Date
  },
  deliveryOtp: { type: String, default: null },
  deliveryOtpExpiresAt: { type: Date, default: null },
  status: { type: String, enum: ['new', 'preparing', 'ready-for-delivery', 'out-for-delivery', 'delivered', 'cancelled'], default: 'new' },
  specialInstructions: String,
  createdAt: { type: Date, default: Date.now }
});

const deliveryPersonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

// --- Review Schema (NEW) ---
const reviewSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Stores one private chat history for each signed-in customer or seller.
// Keeping the messages embedded makes it easy to restore the chat and send
// recent context to the assistant without exposing one user's chats to another.
const chatConversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  userType: { type: String, enum: ['customer', 'seller'], required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

chatConversationSchema.index({ userId: 1, userType: 1 }, { unique: true });

// Models
const User = mongoose.model('User', userSchema);
const Seller = mongoose.model('Seller', sellerSchema);
const Dish = mongoose.model('Dish', dishSchema);
const Order = mongoose.model('Order', orderSchema);
const DeliveryPerson = mongoose.model('DeliveryPerson', deliveryPersonSchema);
const Review = mongoose.model('Review', reviewSchema); // <-- NEW
const ChatConversation = mongoose.model('ChatConversation', chatConversationSchema);

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

const getProjectChatContext = async (userId, userType) => {
  const dishes = await Dish.find({ isAvailable: true }).populate('sellerId', 'businessName').select('name description price category type prepTime rating sellerId').limit(50);
  const menu = dishes.map(dish => ({
    name: dish.name, price: dish.price, category: dish.category, type: dish.type,
    prepTimeMinutes: dish.prepTime, rating: dish.rating, kitchen: dish.sellerId?.businessName
  }));
  let orders = [];
  if (userType === 'customer') orders = await Order.find({ customerId: userId }).sort({ createdAt: -1 }).limit(10).select('items totalAmount status createdAt');
  if (userType === 'seller') orders = await Order.find({ sellerId: userId }).sort({ createdAt: -1 }).limit(10).select('items totalAmount status createdAt');
  if (userType === 'delivery') orders = await Order.find({ deliveryPersonId: userId }).sort({ createdAt: -1 }).limit(10).select('items status deliveryAddress createdAt');
  return { role: userType, liveMenu: menu, relevantOrders: orders };
};

const localProjectReply = (message, context) => {
  const query = message.toLowerCase();
  const mentioned = context.liveMenu.filter(dish => query.includes(dish.name.toLowerCase()));
  if (mentioned.length) return mentioned.map(dish => `${dish.name} is available from ${dish.kitchen} for ₹${dish.price} (${dish.type}, about ${dish.prepTimeMinutes} minutes).`).join(' ');
  const asksForFood = /what.*(can|should).*order|what.*order|food|dish|menu|suggest|recommend|hungry|eat/.test(query);
  if (asksForFood) {
    const vegOnly = /veg|vegetarian/.test(query);
    const underMatch = query.match(/under\s*(?:₹|rs\.?|inr)?\s*(\d+)/);
    let choices = context.liveMenu.filter(dish => !vegOnly || dish.type === 'veg');
    if (underMatch) choices = choices.filter(dish => dish.price <= Number(underMatch[1]));
    if (!choices.length) return 'I could not find a matching available dish right now. Try asking for the full menu.';
    return `You can order: ${choices.slice(0, 6).map(dish => `${dish.name} from ${dish.kitchen} — ₹${dish.price} (${dish.type})`).join('; ')}.`;
  }
  if (query.includes('order') || query.includes('delivery')) {
    const latest = context.relevantOrders[0];
    return latest ? `Your latest relevant order is currently ${latest.status}.` : 'There are no relevant orders in your account yet.';
  }
  return 'I can help with the live Home Plate menu, dish details, prices, and your order status. Try asking “What vegetarian dishes are available?”';
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

// Delivery-person registration and login
app.post('/api/delivery/register', async (req, res) => {
  try {
    const { name, username, email, password, phone } = req.body;
    if (!name || !username || !email || !password || !phone) return res.status(400).json({ error: 'All fields are required.' });
    const existing = await DeliveryPerson.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ error: 'Email or username already registered.' });
    const deliveryPerson = await DeliveryPerson.create({ name, username, email, phone, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ message: 'Delivery account created. Please log in.', deliveryPerson: { id: deliveryPerson._id, name } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/delivery/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const deliveryPerson = await DeliveryPerson.findOne({ username });
    if (!deliveryPerson || !(await bcrypt.compare(password, deliveryPerson.password))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: deliveryPerson._id, userType: 'delivery' }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });
    res.json({ token, deliveryPerson: { id: deliveryPerson._id, name: deliveryPerson.name } });
  } catch (error) { res.status(500).json({ error: error.message }); }
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

    const logoUrl = publicFileUrl(req, req.file.filename);

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
    const imageUrl = publicFileUrl(req, req.file.filename);
    
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
    
    const { items, deliveryAddress, paymentMethod, specialInstructions, sellerId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one dish is required to place an order.' });
    }
    if (!sellerId || !mongoose.isValidObjectId(sellerId)) {
      return res.status(400).json({ error: 'A valid seller is required.' });
    }
    if (!deliveryAddress || !['cod', 'online'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'A delivery address and valid payment method are required.' });
    }

    const seller = await Seller.findById(sellerId).select('_id');
    if (!seller) return res.status(404).json({ error: 'Seller not found.' });

    const dishIds = items.map(item => item.dishId);
    if (dishIds.some(id => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ error: 'One or more selected dishes are invalid.' });
    }
    const databaseDishes = await Dish.find({
      _id: { $in: dishIds }, sellerId, isAvailable: true
    }).select('_id name price');
    const dishById = new Map(databaseDishes.map(dish => [String(dish._id), dish]));
    if (dishById.size !== new Set(dishIds.map(String)).size) {
      return res.status(400).json({ error: 'All dishes must be available and belong to the selected seller.' });
    }

    const validatedItems = items.map(item => {
      const quantity = Number(item.quantity);
      const dish = dishById.get(String(item.dishId));
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Each dish quantity must be at least 1.');
      return { dishId: dish._id, name: dish.name, price: dish.price, quantity };
    });
    const totalAmount = validatedItems.reduce((total, item) => total + item.price * item.quantity, 0);
    
    const order = new Order({
      customerId: req.userId,
      sellerId,
      items: validatedItems,
      totalAmount,
      deliveryAddress,
      paymentMethod,
      specialInstructions,
      // The customer receives this OTP as soon as the order is placed. It is
      // verified by the delivery person only when handing over the food.
      deliveryOtp: String(Math.floor(100000 + Math.random() * 900000)),
      deliveryOtpExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
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

// Lightweight endpoint used by the customer live-tracking widget. It avoids
// refetching and rerendering the full order history every time GPS changes.
app.get('/api/orders/:orderId/tracking', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'customer') return res.status(403).json({ error: 'Customer access required.' });
    const order = await Order.findOne({ _id: req.params.orderId, customerId: req.userId })
      .select('status deliveryLocation deliveryPersonId deliveryOtp deliveryOtpExpiresAt');
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    // Orders created before OTP support are upgraded on first customer view.
    if (order.status !== 'delivered' && (!order.deliveryOtp || !order.deliveryOtpExpiresAt || order.deliveryOtpExpiresAt < new Date())) {
      order.deliveryOtp = String(Math.floor(100000 + Math.random() * 900000));
      order.deliveryOtpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await order.save();
    }
    const otpIsActive = order.status !== 'delivered' && order.deliveryOtpExpiresAt > new Date();
    res.json({ status: order.status, deliveryLocation: order.deliveryLocation, hasDeliveryPerson: Boolean(order.deliveryPersonId), deliveryOtp: otpIsActive ? order.deliveryOtp : null });
  } catch (error) { res.status(500).json({ error: 'Could not load tracking information.' }); }
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
    if (!['preparing', 'ready-for-delivery', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid seller order status.' });
    
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

app.get('/api/delivery/orders/available', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'delivery') return res.status(403).json({ error: 'Delivery access required.' });
    const orders = await Order.find({ status: 'ready-for-delivery', deliveryPersonId: null })
      .populate('sellerId', 'businessName address phone')
      .populate('customerId', 'name phone address')
      .sort({ createdAt: 1 });
    res.json(orders);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/delivery/orders/:orderId/accept', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'delivery') return res.status(403).json({ error: 'Delivery access required.' });
    const order = await Order.findOneAndUpdate(
      { _id: req.params.orderId, status: 'ready-for-delivery', deliveryPersonId: null },
      { deliveryPersonId: req.userId, status: 'out-for-delivery' }, { new: true }
    );
    if (!order) return res.status(409).json({ error: 'This order is no longer available.' });
    res.json({ message: 'Delivery accepted.', order });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/delivery/orders/mine', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'delivery') return res.status(403).json({ error: 'Delivery access required.' });
    const orders = await Order.find({ deliveryPersonId: req.userId, status: { $in: ['out-for-delivery', 'delivered'] } })
      .populate('sellerId', 'businessName address phone').populate('customerId', 'name phone address').sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch('/api/delivery/orders/:orderId/delivered', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'delivery') return res.status(403).json({ error: 'Delivery access required.' });
    const { otp } = req.body;
    const activeOrder = await Order.findOne({ _id: req.params.orderId, deliveryPersonId: req.userId, status: 'out-for-delivery' });
    if (!activeOrder) return res.status(404).json({ error: 'Active delivery not found.' });
    if (!otp || otp !== activeOrder.deliveryOtp || !activeOrder.deliveryOtpExpiresAt || activeOrder.deliveryOtpExpiresAt < new Date()) return res.status(400).json({ error: 'Invalid or expired customer delivery OTP.' });
    const order = await Order.findByIdAndUpdate(activeOrder._id, { status: 'delivered', deliveryOtp: null, deliveryOtpExpiresAt: null }, { new: true });
    res.json({ message: 'Order marked delivered.', order });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch('/api/delivery/orders/:orderId/location', authMiddleware, async (req, res) => {
  try {
    if (req.userType !== 'delivery') return res.status(403).json({ error: 'Delivery access required.' });
    const { latitude, longitude } = req.body;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }
    const order = await Order.findOneAndUpdate(
      { _id: req.params.orderId, deliveryPersonId: req.userId, status: 'out-for-delivery' },
      { deliveryLocation: { latitude, longitude, updatedAt: new Date() } }, { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Active delivery not found.' });
    res.json({ message: 'Live location updated.', deliveryLocation: order.deliveryLocation });
  } catch (error) { res.status(500).json({ error: error.message }); }
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
    
    const ratingSummary = await Review.aggregate([
      { $match: { sellerId: new mongoose.Types.ObjectId(req.userId) } },
      { $group: { _id: null, average: { $avg: '$rating' } } }
    ]);
    const avgRating = ratingSummary.length ? ratingSummary[0].average : 0;
    
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
        if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(sellerId) ||
            !Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
            return res.status(400).json({ error: 'A valid delivered order, seller, and rating from 1 to 5 are required.' });
        }
        const order = await Order.findOne({
            _id: orderId, customerId: req.userId, sellerId, status: 'delivered'
        }).select('_id');
        if (!order) {
            return res.status(403).json({ error: 'You can review only your own delivered orders.' });
        }

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


// Get the signed-in user's saved chatbot history.
app.get('/api/chatbot/history', authMiddleware, async (req, res) => {
    try {
        const conversation = await ChatConversation.findOne({
            userId: req.userId,
            userType: req.userType
        }).select('messages');
        res.json({ messages: conversation ? conversation.messages : [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load chat history.' });
    }
});

// --- Chatbot Route ---
app.post('/api/chatbot', authMiddleware, async (req, res) => {
    try {
        const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
        if (!message) {
            return res.status(400).json({ error: 'A chat message is required.' });
        }
        if (message.length > 2000) {
            return res.status(400).json({ error: 'Chat messages must be 2000 characters or fewer.' });
        }

        const systemPrompt = "You are a helpful assistant for a food delivery app called 'Home Plate'. You answer questions for both customers and sellers. Keep your answers concise, friendly, and helpful. For customers, you can answer questions about orders or food. For sellers, you can answer questions about managing their menu or orders.";

        const existingConversation = await ChatConversation.findOne({
            userId: req.userId,
            userType: req.userType
        }).select('messages');
        const history = existingConversation ? existingConversation.messages.slice(-20) : [];
        const projectContext = await getProjectChatContext(req.userId, req.userType);

        let reply;
        if (!process.env.OPENAI_API_KEY) {
            reply = localProjectReply(message, projectContext);
        } else try {
            const completion = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: "system", content: `${systemPrompt}\n\nUse only this current project data when discussing menu items, prices, kitchens, or orders. Never invent unavailable dishes or order statuses. Project data:\n${JSON.stringify(projectContext)}` },
                    ...history.map(entry => ({ role: entry.role, content: entry.content })),
                    { role: "user", content: message }
                ]
            });
            reply = completion.choices[0].message.content.trim();
        } catch (aiError) {
            console.error('OpenAI Error:', aiError.message);
            reply = localProjectReply(message, projectContext);
        }
        await ChatConversation.findOneAndUpdate(
            { userId: req.userId, userType: req.userType },
            {
                $setOnInsert: { userId: req.userId, userType: req.userType },
                $push: {
                    messages: {
                        $each: [{ role: 'user', content: message }, { role: 'assistant', content: reply }],
                        $slice: -100
                    }
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json({ reply });
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
