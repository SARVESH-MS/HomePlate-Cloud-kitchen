import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    ShoppingCart, Search, Plus, Minus, Trash2, LogOut, TrendingUp, Package, 
    DollarSign, Star, X, Clock, MapPin, MessageCircle, ArrowLeft, Bot
} from 'lucide-react';

// --- API Imports (Updated) ---
import { 
    authAPI, dishAPI, orderAPI, sellerAPI, reviewAPI, recommendationAPI, deliveryAPI
} from './services/api';

// --- NEW COMPONENT IMPORT ---
import Chatbot from './components/Chatbot';

const backendOrigin = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const foodImageUrl = (image) => image?.startsWith('/uploads/') ? `${backendOrigin}${image}` : image;

// --- 1. UI FIX: FoodTypeIndicator (Smaller, No Text) ---
const FoodTypeIndicator = ({ type }) => {
    const isVeg = type === 'veg';
    const bgColor = isVeg ? 'bg-green-500' : 'bg-red-500';
    const borderColor = isVeg ? 'border-green-500' : 'border-red-500';

    return (
        <div className="flex items-center">
            <div className={`w-6 h-6 flex items-center justify-center rounded-md border-2 ${borderColor} p-0.5 shadow-sm bg-white`}>
                <div className={`w-3 h-3 rounded-full ${bgColor}`}></div>
            </div>
        </div>
    );
};

const RecenterMap = ({ latitude, longitude }) => {
    const map = useMap();
    useEffect(() => { map.setView([latitude, longitude], map.getZoom(), { animate: true }); }, [latitude, longitude, map]);
    return null;
};

const LiveDeliveryMap = ({ location }) => {
    if (!location?.latitude || !location?.longitude) return null;
    const position = [location.latitude, location.longitude];
    return <div className="mt-3 overflow-hidden rounded-xl border border-blue-200">
        <MapContainer center={position} zoom={15} scrollWheelZoom={false} style={{ height: '260px', width: '100%' }}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <RecenterMap latitude={location.latitude} longitude={location.longitude} />
            <CircleMarker center={position} radius={13} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}><Popup>Delivery partner is here<br />Updated: {new Date(location.updatedAt).toLocaleTimeString()}</Popup></CircleMarker>
        </MapContainer>
    </div>;
};

const OrderTrackingCard = ({ order }) => {
    const [tracking, setTracking] = useState({ status: order.status, deliveryLocation: order.deliveryLocation });
    useEffect(() => {
        let isMounted = true;
        const refreshTracking = async () => {
            try {
                const response = await orderAPI.getTracking(order._id);
                if (isMounted) setTracking(response.data);
            } catch (error) { console.error('Tracking refresh failed:', error); }
        };
        refreshTracking();
        const timer = setInterval(refreshTracking, 15000);
        return () => { isMounted = false; clearInterval(timer); };
    }, [order._id]);
    const status = tracking.status;
    return <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
        <div className="flex justify-between items-center mb-3"><p className="font-bold text-orange-700">Live order tracking</p><span className="text-xs text-gray-500">Live updates every 15 sec</span></div>
        <div className="flex items-center gap-1 text-xs font-semibold"><span className="bg-green-500 text-white rounded-full px-2 py-1">Ordered</span><span className="h-0.5 flex-1 bg-orange-300"></span><span className={`${['preparing','ready-for-delivery','out-for-delivery','delivered'].includes(status) ? 'bg-green-500 text-white' : 'bg-white text-gray-400'} rounded-full px-2 py-1`}>Preparing</span><span className="h-0.5 flex-1 bg-orange-300"></span><span className={`${['out-for-delivery','delivered'].includes(status) ? 'bg-blue-500 text-white' : 'bg-white text-gray-400'} rounded-full px-2 py-1`}>On the way</span><span className="h-0.5 flex-1 bg-orange-300"></span><span className={`${status === 'delivered' ? 'bg-green-500 text-white' : 'bg-white text-gray-400'} rounded-full px-2 py-1`}>Delivered</span></div>
        {status === 'out-for-delivery' && <p className="text-sm text-blue-700 font-medium mt-3">Your delivery partner is on the way.</p>}
        {tracking.deliveryOtp && <div className="mt-3 bg-white border border-orange-200 rounded-lg p-3"><p className="text-xs text-gray-500">Your delivery OTP. Share it with the delivery partner only after you receive the food.</p><p className="text-2xl tracking-[0.35em] font-extrabold text-orange-600 mt-1">{tracking.deliveryOtp}</p></div>}
        {status === 'out-for-delivery' && tracking.deliveryLocation?.latitude ? <LiveDeliveryMap location={tracking.deliveryLocation} /> : status === 'out-for-delivery' && <p className="text-xs text-gray-500 mt-2">Waiting for the delivery partner to start live location sharing.</p>}
    </div>;
};
// ------------------------------------------

// ------------------------------------------------------------------
// --- ALL COMPONENTS (Defined Outside App) ---
// ------------------------------------------------------------------

// --- COMPONENT: DishCard ---
const DishCard = ({ dish, onViewDetails }) => {
    const stars = '★'.repeat(Math.floor(dish.rating)) + '☆'.repeat(5 - Math.floor(dish.rating));

    return (
        <div
            className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition transform hover:-translate-y-2 cursor-pointer"
            onClick={() => onViewDetails(dish)}
        >
            <img src={foodImageUrl(dish.image)} alt={dish.name} className="w-full h-48 object-cover" />
            <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg md:text-xl font-bold text-gray-800">{dish.name}</h3>
                    <FoodTypeIndicator type={dish.type} />
                </div>
                <p className="text-sm text-gray-600 mb-3">{dish.description}</p>
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xl md:text-2xl font-bold text-orange-500">₹{dish.price}</span>
                    <span className="text-yellow-500">{stars}</span>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onViewDetails(dish); }}
                    className="w-full bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-700 transition text-sm md:text-base flex items-center justify-center gap-2"
                >
                    <ShoppingCart className='w-4 h-4' /> View & Order
                </button>
            </div>
        </div>
    );
};

// --- COMPONENT: DishDetailPage ---
const DishDetailPage = ({ dish, onAddToCart, onBack }) => {
    const [quantity, setQuantity] = useState(1);
    const [instructions, setInstructions] = useState('');

    if (!dish) {
        return <div className='p-12 text-center text-red-500'>Dish not found!</div>;
    }

    const stars = '★'.repeat(Math.floor(dish.rating)) + '☆'.repeat(5 - Math.floor(dish.rating));

    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div className="container mx-auto px-4 md:px-6 max-w-4xl bg-white shadow-xl rounded-xl overflow-hidden">
                <div className='p-4 md:p-6 border-b flex items-center gap-4'>
                    <button onClick={onBack} className='text-gray-600 hover:text-orange-500'>
                        <ArrowLeft className='w-6 h-6' />
                    </button>
                    <h1 className='text-2xl font-bold text-gray-800'>Order Details</h1>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className='p-0'>
                        <img src={foodImageUrl(dish.image)} alt={dish.name} className="w-full h-80 object-cover" />
                    </div>
                    <div className="p-4 md:p-6">
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="text-3xl font-bold text-gray-800">{dish.name}</h2>
                            <FoodTypeIndicator type={dish.type} />
                        </div>
                        <p className="text-gray-700 mb-4 text-sm">{dish.description}</p>
                        <div className='flex items-center justify-between mb-4 border-b pb-4'>
                            <span className="text-3xl font-bold text-orange-600">₹{dish.price}</span>
                            <div className="flex items-center gap-2">
                                <Star className='w-5 h-5 text-yellow-500 fill-yellow-500' />
                                <span className="font-bold text-xl text-yellow-500">{dish.rating.toFixed(1)}</span>
                            </div>
                        </div>
                        <div className='space-y-3 mb-6 text-base text-gray-600'>
                            <p className='flex items-center gap-3'><MapPin className='w-5 h-5 text-orange-500' /> **Kitchen:** <span className='font-semibold text-gray-800'>{dish.sellerId?.businessName || 'Kitchen'}</span></p>
                            <p className='flex items-center gap-3'><Clock className='w-5 h-5 text-orange-500' /> **Prep Time:** {dish.prepTime} mins</p>
                        </div>
                        <div className='mb-6 p-4 bg-gray-50 rounded-lg'>
                            <label htmlFor="custom-instructions" className="block text-gray-700 font-semibold mb-2">
                                Special Instructions (Customization)
                            </label>
                            <textarea
                                id="custom-instructions"
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                rows="2"
                                placeholder="e.g., Low sugar, extra spice, no onions..."
                            ></textarea>
                        </div>
                        <div className="sticky bottom-0 bg-white p-4 -mx-4 md:static md:p-0 flex items-center justify-between gap-4 border-t md:border-t-0">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                    className="bg-gray-800 text-white w-10 h-10 rounded-full hover:bg-gray-700 flex items-center justify-center"
                                >
                                    <Minus className="w-5 h-5" />
                                </button>
                                <span className="font-bold text-xl">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(q => q + 1)}
                                    className="bg-gray-800 text-white w-10 h-10 rounded-full hover:bg-gray-700 flex items-center justify-center"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={() => onAddToCart(dish, quantity, instructions)}
                                className="flex-1 bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition font-semibold text-lg flex items-center justify-center gap-2"
                            >
                                <ShoppingCart className='w-5 h-5' /> Add to Cart (₹{dish.price * quantity})
                            </button>
                        </div>
                    </div>
                </div>
                {/* Review section can be built out here later */}
            </div>
        </div>
    );
};

// --- COMPONENT: CustomerHeader ---
const CustomerHeader = ({ cartCount, currentUser, onNavigate, onLogout, searchTerm, onSearchChange, mobileMenuOpen, onToggleMobileMenu }) => (
    <header className="bg-gray-800 text-white sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
                <h1
                    className="text-xl md:text-2xl font-bold cursor-pointer hover:text-orange-400 transition"
                    onClick={() => onNavigate('home')}
                >
                    Home Plate
                </h1>
                <button
                    className="md:hidden text-white"
                    onClick={onToggleMobileMenu}
                >
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    )}
                </button>
                {currentUser?.userType === 'customer' && <button
                    onClick={() => onNavigate('cart')}
                    className="md:hidden relative text-white hover:text-orange-400 transition"
                    aria-label="Open cart"
                >
                    <ShoppingCart className="w-6 h-6" />
                    {cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                            {cartCount}
                        </span>
                    )}
                </button>}
                <nav className={`${mobileMenuOpen ? 'flex' : 'hidden'} md:flex absolute md:relative top-16 md:top-0 left-0 right-0 bg-gray-800 md:bg-transparent flex-col md:flex-row items-center gap-4 md:gap-6 p-4 md:p-0 shadow-lg md:shadow-none`}>
                    <div className="relative w-full md:w-auto mb-4 md:mb-0">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search dishes..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            onFocus={() => onNavigate('menu')}
                            className="pl-10 pr-4 py-2 rounded-full bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 w-full md:w-64"
                        />
                    </div>
                    <button
                        onClick={() => onNavigate('home')}
                        className="hover:text-orange-400 transition w-full md:w-auto text-left md:text-center"
                    >
                        Home
                    </button>
                    <button
                        onClick={() => onNavigate('menu')}
                        className="hover:text-orange-400 transition w-full md:w-auto text-left md:text-center"
                    >
                        Menu
                    </button>
                    <button
                        onClick={() => onNavigate('customerOrders')}
                        className="hover:text-orange-400 transition w-full md:w-auto text-left md:text-center"
                    >
                        My Orders
                    </button>
                    {!currentUser && (
                        <button
                            onClick={() => onNavigate('sellerSignup')}
                            className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-full transition text-sm w-full md:w-auto"
                        >
                            Become Seller
                        </button>
                    )}
                    {!currentUser && (
                        <button onClick={() => onNavigate('deliveryLogin')} className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-full transition text-sm w-full md:w-auto text-left md:text-center">
                            Delivery Login
                        </button>
                    )}
                    {currentUser?.userType === 'customer' && <button
                        onClick={() => onNavigate('cart')}
                        className="relative hover:text-orange-400 transition hidden md:block"
                    >
                        <ShoppingCart className="w-6 h-6" />
                        {cartCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                                {cartCount}
                            </span>
                        )}
                    </button>}
                    {currentUser && currentUser.userType === 'customer' ? (
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <span className="text-sm">{currentUser.name}</span>
                            <button
                                onClick={onLogout}
                                className="hover:text-orange-400"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => onNavigate('customerLogin')}
                            className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-full transition w-full md:w-auto"
                        >
                            Login
                        </button>
                    )}
                </nav>
            </div>
        </div>
    </header>
);

const LoginChoicePage = ({ onNavigate }) => (
    <main className="min-h-screen bg-gray-100 py-12 px-4"><section className="max-w-3xl mx-auto text-center">
        <p className="text-orange-500 font-bold tracking-widest text-sm">WELCOME TO HOME PLATE</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2">How would you like to continue?</h1>
        <p className="text-gray-600 mt-3">Choose your role to sign in or create a new account.</p>
        <div className="grid md:grid-cols-3 gap-5 mt-10 text-left">
            <button onClick={() => onNavigate('customerLogin')} className="bg-white p-6 rounded-2xl shadow-sm border hover:border-orange-400 hover:shadow-lg transition"><h2 className="text-xl font-bold text-gray-900">Customer</h2><p className="text-gray-500 mt-2">Order food, track deliveries, and review kitchens.</p><span className="block mt-5 font-bold text-orange-500">Customer login →</span></button>
            <button onClick={() => onNavigate('sellerLogin')} className="bg-white p-6 rounded-2xl shadow-sm border hover:border-orange-400 hover:shadow-lg transition"><h2 className="text-xl font-bold text-gray-900">Seller / Chef</h2><p className="text-gray-500 mt-2">Manage your kitchen, dishes, and incoming orders.</p><span className="block mt-5 font-bold text-orange-500">Seller login →</span></button>
            <button onClick={() => onNavigate('deliveryLogin')} className="bg-white p-6 rounded-2xl shadow-sm border hover:border-orange-400 hover:shadow-lg transition"><h2 className="text-xl font-bold text-gray-900">Delivery Partner</h2><p className="text-gray-500 mt-2">Accept pickups, share GPS, and deliver orders.</p><span className="block mt-5 font-bold text-orange-500">Delivery login →</span></button>
        </div>
    </section></main>
);

const DeliveryHeader = ({ currentUser, onNavigate, onLogout }) => (
    <header className="bg-gray-800 text-white sticky top-0 z-50 shadow-lg"><div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <h1 onClick={() => onNavigate('deliveryDashboard')} className="text-xl font-bold cursor-pointer">Home Plate Delivery</h1>
        <div className="flex items-center gap-4"><button onClick={() => onNavigate('deliveryDashboard')} className="hover:text-orange-400">Deliveries</button><span>{currentUser?.name}</span><button onClick={onLogout}><LogOut className="w-5 h-5" /></button></div>
    </div></header>
);

// --- COMPONENT: SellerHeader ---
const SellerHeader = ({ currentUser, onNavigate, onLogout, mobileMenuOpen, onToggleMobileMenu }) => (
    <header className="bg-gray-800 text-white sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-8">
                    <div className="text-gray-400 text-xs md:text-sm">Cloud Kitchen - Seller Dashboard</div>
                    <h1
                        className="text-xl md:text-2xl font-bold cursor-pointer hover:text-orange-400 transition"
                        onClick={() => onNavigate('sellerDashboard')}
                    >
                        Home Plate Seller
                    </h1>
                </div>
                <button
                    className="md:hidden text-white"
                    onClick={onToggleMobileMenu}
                >
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    )}
                </button>
                <nav className={`${mobileMenuOpen ? 'flex' : 'hidden'} md:flex absolute md:relative top-16 md:top-0 left-0 right-0 bg-gray-800 md:bg-transparent flex-col md:flex-row items-center gap-4 md:gap-6 p-4 md:p-0 shadow-lg md:shadow-none`}>
                    <button
                        onClick={() => onNavigate('sellerDashboard')}
                        className="hover:text-orange-400 transition w-full md:w-auto text-left md:text-center"
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => onNavigate('addDish')}
                        className="hover:text-orange-400 transition w-full md:w-auto text-left md:text-center"
                    >
                        Add Dishes
                    </button>
                    <button
                        onClick={() => onNavigate('sellerOrders')}
                        className="hover:text-orange-400 transition w-full md:w-auto text-left md:text-center"
                    >
                        Orders
                    </button>
                    <button
                        onClick={() => onNavigate('sellerAbout')}
                        className="hover:text-orange-400 transition w-full md:w-auto text-left md:text-center"
                    >
                        Profile
                    </button>
                    {currentUser && (
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <span className="text-sm">{currentUser.name}</span>
                            <button
                                onClick={onLogout}
                                className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-full transition text-sm"
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </nav>
            </div>
        </div>
    </header>
);

// --- COMPONENT: HomePage (With Hero Image) ---
const HomePage = ({ onNavigate, dishes, onViewDetails, cart }) => {
    
    const [aiSuggestions, setAiSuggestions] = useState([]);

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                const cartItems = cart.map(item => ({ 
                    dishId: item._id, 
                    type: item.type, 
                    category: item.category 
                }));
                // Only fetch if logged in
                const token = localStorage.getItem('authToken');
                if (token) {
                    const response = await recommendationAPI.getRecommendations(cartItems);
                    setAiSuggestions(response.data);
                }
            } catch (error) {
                console.error("Error fetching recommendations:", error);
            }
        };
        fetchRecommendations();
    }, [cart]);

    return (
        <div>
            {/* --- THIS SECTION IS UPDATED (REQUEST #6) --- */}
            <section 
                className="relative text-white py-12 md:py-20 bg-cover bg-center"
                style={{ backgroundImage: 'url(https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg)' }}
            >
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black/50"></div>
                
                {/* Content */}
                <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
                    <h1 className="text-3xl md:text-5xl font-bold mb-4">Delicious Food Delivered</h1>
                    <p className="text-lg md:text-xl mb-8">Order from the best restaurants and cloud kitchens in your area</p>
                    <button 
                        onClick={() => onNavigate('menu')}
                        className="bg-orange-500 text-white px-6 md:px-8 py-3 rounded-full font-semibold hover:bg-orange-600 transition transform hover:scale-105"
                    >
                        Order Now
                    </button>
                </div>
            </section>
            {/* --- END OF UPDATED SECTION --- */}

            {aiSuggestions.length > 0 && (
                <section className="bg-white py-12 md:py-16">
                    <div className="container mx-auto px-4 md:px-6">
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">AI Recommendations</h2>
                        <p className="text-gray-600 mb-8">Personalized suggestions just for you</p>
                        {aiSuggestions.map((suggestion, idx) => (
                            <div key={idx} className="mb-8">
                                <h3 className="text-lg md:text-xl font-semibold text-orange-500 mb-4">{suggestion.reason}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {suggestion.dishes.map(dish => (
                                        <DishCard key={dish._id} dish={dish} onViewDetails={onViewDetails} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="bg-gray-100 py-12 md:py-16">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 underline">Featured Dishes</h2>
                            <p className="text-gray-600 mt-2">Top picks from our menu</p>
                        </div>
                        <button
                            onClick={() => onNavigate('menu')}
                            className="text-orange-500 border border-orange-500 px-4 md:px-6 py-2 rounded-full hover:bg-orange-500 hover:text-white transition"
                        >
                            See All
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {dishes.slice(0, 3).map(dish => (
                            <DishCard key={dish._id} dish={dish} onViewDetails={onViewDetails} />
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

// --- COMPONENT: MenuPage ---
const MenuPage = ({ filteredDishes, categoryFilter, onCategoryChange, onViewDetails, isLoading }) => (
    <div className="bg-gray-100 min-h-screen py-8">
        <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800 underline">Our Menu</h2>
                    <p className="text-gray-600 mt-2">All Available Dishes</p>
                </div>
                <select
                    value={categoryFilter}
                    onChange={(e) => onCategoryChange(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 w-full md:w-auto"
                >
                    <option value="all">All Categories</option>
                    <option value="veg">Vegetarian</option>
                    <option value="non-veg">Non-Vegetarian</option>
                </select>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-gray-600 text-lg">Loading dishes...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDishes.map(dish => (
                        <DishCard key={dish._id} dish={dish} onViewDetails={onViewDetails} />
                    ))}
                </div>
            )}
        </div>
    </div>
);

// --- COMPONENT: CartPage ---
const CartPage = ({ cart, onUpdateQuantity, onRemoveFromCart, onNavigate, cartTotal }) => (
    <div className="bg-gray-100 min-h-screen py-8">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <h2 className="text-2xl md:text-3xl font-bold text-orange-500 text-center mb-8">Your Cart</h2>
            {cart.length === 0 ? (
                <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                    <ShoppingCart className="w-16 h-16 md:w-24 md:h-24 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600 text-lg md:text-xl">Your cart is empty</p>
                    <button
                        onClick={() => onNavigate('menu')}
                        className="mt-6 bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition"
                    >
                        Browse Menu
                    </button>
                </div>
            ) : (
                <>
                    <div className="space-y-4 mb-6">
                        {cart.map(item => (
                            <div key={item.cartItemId} className="bg-white rounded-xl shadow-lg p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                                <img src={foodImageUrl(item.image)} alt={item.name} className="w-full md:w-24 h-48 md:h-24 rounded-lg object-cover" />
                                <div className="flex-1 w-full">
                                    <h3 className="text-lg md:text-xl font-bold text-gray-800">{item.name}</h3>
                                    <p className="text-orange-500 font-bold">₹{item.price} each</p>
                                    {item.instructions && (
                                        <p className='text-xs text-gray-600 mt-1 italic'>**Note to Chef:** {item.instructions}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2">
                                        <button
                                            onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                                            className="bg-gray-800 text-white w-8 h-8 rounded-full hover:bg-gray-700 flex items-center justify-center"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="font-semibold">Qty: {item.quantity}</span>
                                        <button
                                            onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                                            className="bg-gray-800 text-white w-8 h-8 rounded-full hover:bg-gray-700 flex items-center justify-center"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-left md:text-right w-full md:w-auto">
                                    <div className="text-lg md:text-xl font-bold text-gray-800 mb-3">₹{item.price * item.quantity}</div>
                                    <button
                                        onClick={() => onRemoveFromCart(item.cartItemId)}
                                        className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" /> Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-orange-500 text-white rounded-xl shadow-lg p-6 text-center">
                        <h3 className="text-xl md:text-2xl font-bold mb-4">Total: ₹{cartTotal}</h3>
                        <button
                            onClick={() => onNavigate('checkout')}
                            className="bg-white text-orange-500 px-6 md:px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition w-full md:w-auto"
                        >
                            Proceed to Checkout
                        </button>
                    </div>
                </>
            )}
        </div>
    </div>
);

// --- COMPONENT: CustomerLoginPage ---
const CustomerLoginPage = ({ onLoginSuccess, onShowNotification }) => {
    const [credentials, setCredentials] = useState({ email: '', password: '' });
    const [isSignup, setIsSignup] = useState(false);
    const [signupData, setSignupData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        password: ''
    });

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await authAPI.customerLogin(credentials);
            onLoginSuccess(response.data.user, response.data.token); 
            onShowNotification('Login successful!');
        } catch (error) {
            const msg = error.response?.data?.error || 'Invalid credentials or server error.';
            onShowNotification(msg);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            const response = await authAPI.customerRegister(signupData);
            onShowNotification(response.data.message || 'Account created! Please login.');
            setIsSignup(false);
        } catch (error) {
            const msg = error.response?.data?.error || 'Registration failed.';
            onShowNotification(msg);
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen py-8 md:py-12">
            <div className="container mx-auto px-4 md:px-6 max-w-md">
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-orange-500 text-center mb-6">
                        {isSignup ? 'Customer Sign Up' : 'Customer Login'}
                    </h2>
                    {!isSignup ? (
                        <form onSubmit={handleLogin}>
                            <div className="mb-4">
                                <label className="block text-gray-700 font-semibold mb-2">Email</label>
                                <input
                                    type="email"
                                    value={credentials.email}
                                    onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    required
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">Password</label>
                                <input
                                    type="password"
                                    value={credentials.password}
                                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                            >
                                Login
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleSignup}>
                            <div className="mb-4">
                                <label className="block text-gray-700 font-semibold mb-2">Full Name</label>
                                <input
                                    type="text"
                                    value={signupData.name}
                                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 font-semibold mb-2">Email</label>
                                <input
                                    type="email"
                                    value={signupData.email}
                                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 font-semibold mb-2">Phone</label>
                                <input
                                    type="tel"
                                    value={signupData.phone}
                                    onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 font-semibold mb-2">Address</label>
                                <textarea
                                    value={signupData.address}
                                    onChange={(e) => setSignupData({ ...signupData, address: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    rows="3"
                                    required
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">Password</label>
                                <input
                                    type="password"
                                    value={signupData.password}
                                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                            >
                                Sign Up
                            </button>
                        </form>
                    )}
                    <div className="mt-6 text-center">
                        <p className="text-gray-600">
                            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                            <button
                                onClick={() => setIsSignup(!isSignup)}
                                className="text-orange-500 font-semibold hover:underline"
                            >
                                {isSignup ? 'Login' : 'Sign up'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: SellerLoginPage ---
const SellerLoginPage = ({ onLoginSuccess, onShowNotification, onNavigate }) => {
    const [credentials, setCredentials] = useState({ username: '', password: '' });

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await authAPI.sellerLogin(credentials);
            onLoginSuccess(response.data.seller, response.data.token);
            onShowNotification('Seller login successful!');
        } catch (error) {
            const msg = error.response?.data?.error || 'Invalid credentials or server error.';
            onShowNotification(msg);
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen py-8 md:py-12">
            <div className="container mx-auto px-4 md:px-6 max-w-md">
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-orange-500 text-center mb-6">Seller Login</h2>
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Username</label>
                            <input
                                type="text"
                                value={credentials.username}
                                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                required
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700 font-semibold mb-2">Password</label>
                            <input
                                type="password"
                                value={credentials.password}
                                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                        >
                            Login
                        </button>
                    </form>
                    <div className="mt-6 text-center">
                        <p className="text-gray-600">
                            Don't have an account?{' '}
                            <button
                                onClick={() => onNavigate('sellerSignup')}
                                className="text-orange-500 font-semibold hover:underline"
                            >
                                Sign up
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DeliveryLoginPage = ({ onLoginSuccess, onShowNotification }) => {
    const [isSignup, setIsSignup] = useState(false);
    const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', password: '' });
    const submit = async (e) => {
        e.preventDefault();
        try {
            if (isSignup) {
                await authAPI.deliveryRegister(form);
                onShowNotification('Delivery account created. Please log in.');
                setIsSignup(false);
            } else {
                const response = await authAPI.deliveryLogin({ username: form.username, password: form.password });
                onLoginSuccess({ ...response.data.deliveryPerson, userType: 'delivery' }, response.data.token);
                onShowNotification('Delivery login successful!');
            }
        } catch (error) { onShowNotification(error.response?.data?.error || 'Could not continue.'); }
    };
    return <div className="bg-gray-100 min-h-screen py-12"><div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-orange-500 text-center mb-6">{isSignup ? 'Delivery Registration' : 'Delivery Login'}</h2>
        <form onSubmit={submit} className="space-y-4">
            {isSignup && <><input name="name" placeholder="Full name" value={form.name} onChange={e => setForm({...form, name:e.target.value})} className="w-full p-3 border rounded" required /><input name="email" type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} className="w-full p-3 border rounded" required /><input name="phone" placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} className="w-full p-3 border rounded" required /></>}
            <input name="username" placeholder="Username" value={form.username} onChange={e => setForm({...form, username:e.target.value})} className="w-full p-3 border rounded" required />
            <input name="password" type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password:e.target.value})} className="w-full p-3 border rounded" required />
            <button className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold">{isSignup ? 'Create Delivery Account' : 'Login'}</button>
        </form>
        <button onClick={() => setIsSignup(!isSignup)} className="w-full mt-4 text-orange-500">{isSignup ? 'Already registered? Login' : 'New delivery person? Register'}</button>
    </div></div>;
};

const DeliveryDashboard = ({ onShowNotification }) => {
    const [available, setAvailable] = useState([]); const [mine, setMine] = useState([]); const [isLoading, setIsLoading] = useState(true); const [trackingOrderId, setTrackingOrderId] = useState(null); const watchIdRef = useRef(null);
    const load = async () => { setIsLoading(true); try { const [a, m] = await Promise.all([deliveryAPI.availableOrders(), deliveryAPI.myOrders()]); setAvailable(a.data); setMine(m.data); } catch { onShowNotification('Could not load delivery orders.'); } finally { setIsLoading(false); } };
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const accept = async (id) => { try { await deliveryAPI.acceptOrder(id); onShowNotification('Order accepted.'); load(); } catch (e) { onShowNotification(e.response?.data?.error || 'Could not accept order.'); } };
    const delivered = async (id) => { const otp = window.prompt('Ask the customer for their 6-digit delivery OTP, then enter it here:'); if (!otp) return; try { await deliveryAPI.markDelivered(id, otp.trim()); onShowNotification('OTP verified. Order delivered.'); load(); } catch (error) { onShowNotification(error.response?.data?.error || 'Could not verify delivery OTP.'); } };
    const stopTracking = () => {
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null; setTrackingOrderId(null); onShowNotification('Live location sharing stopped.');
    };
    const shareLocation = (id) => {
        if (!navigator.geolocation) return onShowNotification('Location sharing is not supported by this browser.');
        if (trackingOrderId === id) return stopTracking();
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        const watchId = navigator.geolocation.watchPosition(async ({ coords }) => {
            try { await deliveryAPI.updateLocation(id, coords.latitude, coords.longitude); }
            catch { onShowNotification('Could not update live location.'); }
        }, () => { watchIdRef.current = null; setTrackingOrderId(null); onShowNotification('Allow location permission to start live tracking.'); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
        watchIdRef.current = watchId; setTrackingOrderId(id); onShowNotification('Live tracking started. Keep this page open while delivering.');
    };
    useEffect(() => () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); }, []);
    const active = mine.filter(order => order.status === 'out-for-delivery').length;
    const completed = mine.filter(order => order.status === 'delivered').length;
    const OrderCard = ({ order, action, isActive }) => <article className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition p-5">
        <div className="flex justify-between gap-3 border-b pb-4 mb-4"><div><p className="text-xs font-bold tracking-widest text-gray-400">ORDER #{order._id.slice(-6).toUpperCase()}</p><h3 className="font-bold text-lg text-gray-800 mt-1">{order.items.map(i => `${i.name} × ${i.quantity}`).join(', ')}</h3></div><span className={`h-fit px-3 py-1 rounded-full text-xs font-bold ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{isActive ? 'OUT FOR DELIVERY' : 'READY FOR PICKUP'}</span></div>
        <div className="grid md:grid-cols-2 gap-4 text-sm"><div className="bg-orange-50 rounded-xl p-4"><p className="font-bold text-orange-600 mb-1">PICKUP</p><p className="font-semibold">{order.sellerId?.businessName}</p><p className="text-gray-600">{order.sellerId?.address || 'Kitchen address unavailable'}</p><p className="text-gray-600 mt-1">{order.sellerId?.phone || ''}</p></div><div className="bg-blue-50 rounded-xl p-4"><p className="font-bold text-blue-600 mb-1">DROP-OFF</p><p className="font-semibold">{order.customerId?.name}</p><p className="text-gray-600">{order.deliveryAddress}</p><p className="text-gray-600 mt-1">{order.customerId?.phone || ''}</p></div></div>
        <div className="flex justify-between items-center mt-4"><span className="font-bold text-gray-700">₹{order.totalAmount}</span>{action}</div>
    </article>;
    return <main className="min-h-screen bg-slate-50 py-8 md:py-12"><div className="max-w-6xl mx-auto px-4 md:px-6">
        <section className="bg-gradient-to-r from-orange-500 to-amber-400 text-white rounded-3xl p-6 md:p-9 shadow-lg mb-8"><div className="flex flex-col md:flex-row md:items-center justify-between gap-5"><div><p className="font-semibold text-orange-100">HOME PLATE DELIVERY PARTNER</p><h1 className="text-3xl md:text-4xl font-extrabold mt-1">Deliver smarter, earn better.</h1><p className="mt-2 text-orange-50">Accept prepared orders, navigate pickup details, and confirm each delivery.</p></div><button onClick={load} className="bg-white text-orange-600 font-bold px-5 py-3 rounded-xl hover:bg-orange-50">Refresh orders</button></div></section>
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"><div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-gray-500 text-sm">Available pickups</p><p className="text-3xl font-extrabold text-orange-500 mt-1">{available.length}</p></div><div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-gray-500 text-sm">Active deliveries</p><p className="text-3xl font-extrabold text-blue-600 mt-1">{active}</p></div><div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-gray-500 text-sm">Completed deliveries</p><p className="text-3xl font-extrabold text-green-600 mt-1">{completed}</p></div></section>
        {isLoading ? <div className="text-center py-16 text-gray-500">Loading delivery operations...</div> : <div className="grid lg:grid-cols-2 gap-8"><section><div className="flex items-center justify-between mb-4"><div><h2 className="text-2xl font-bold text-gray-900">Available pickups</h2><p className="text-gray-500">Orders prepared by kitchens</p></div><span className="bg-orange-100 text-orange-700 font-bold px-3 py-1 rounded-full">{available.length}</span></div><div className="space-y-4">{available.length ? available.map(order => <OrderCard key={order._id} order={order} action={<button onClick={() => accept(order._id)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold">Accept delivery</button>} />) : <div className="bg-white border border-dashed rounded-2xl p-10 text-center"><Package className="w-12 h-12 text-orange-300 mx-auto mb-3" /><h3 className="font-bold text-gray-700">All caught up</h3><p className="text-gray-500 text-sm mt-1">New pickup requests will appear here.</p></div>}</div></section><section><div className="flex items-center justify-between mb-4"><div><h2 className="text-2xl font-bold text-gray-900">My deliveries</h2><p className="text-gray-500">Orders you have accepted</p></div><span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full">{mine.length}</span></div><div className="space-y-4">{mine.length ? mine.map(order => <OrderCard key={order._id} order={order} isActive={order.status === 'out-for-delivery'} action={order.status === 'out-for-delivery' ? <div className="flex gap-2"><button onClick={() => shareLocation(order._id)} className={`${trackingOrderId === order._id ? 'bg-blue-600 text-white' : 'border border-blue-500 text-blue-600'} px-3 py-2 rounded-xl font-bold`}>{trackingOrderId === order._id ? 'Stop tracking' : 'Start live tracking'}</button><button onClick={() => { if (trackingOrderId === order._id) stopTracking(); delivered(order._id); }} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl font-bold">Mark delivered</button></div> : <span className="font-bold text-green-600">Delivered</span>} />) : <div className="bg-white border border-dashed rounded-2xl p-10 text-center"><Clock className="w-12 h-12 text-blue-300 mx-auto mb-3" /><h3 className="font-bold text-gray-700">No active deliveries</h3><p className="text-gray-500 text-sm mt-1">Accept a pickup to start a delivery.</p></div>}</div></section></div>}
    </div></main>;
};

// --- COMPONENT: SellerSignupPage ---
const SellerSignupPage = ({ onShowNotification, onNavigate }) => {
    const [formData, setFormData] = useState({
        businessName: '',
        ownerName: '',
        username: '',
        email: '',
        phone: '',
        address: '',
        fssaiNumber: '',
        password: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await authAPI.sellerRegister(formData);
            onShowNotification(response.data.message || 'Seller account created! Please login.');
            onNavigate('sellerLogin');
        } catch (error) {
            const msg = error.response?.data?.error || 'Registration failed.';
            onShowNotification(msg);
        }
    };
    
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="bg-gray-100 min-h-screen py-8 md:py-12">
            <div className="container mx-auto px-4 md:px-6 max-w-2xl">
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-orange-500 text-center mb-6">Seller Registration</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Business Name *</label>
                                <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Owner Name *</label>
                                <input type="text" name="ownerName" value={formData.ownerName} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Username *</label>
                                <input type="text" name="username" value={formData.username} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Email *</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Phone *</label>
                                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">FSSAI License *</label>
                                <input type="text" name="fssaiNumber" value={formData.fssaiNumber} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-gray-700 font-semibold mb-2">Business Address *</label>
                            <textarea name="address" value={formData.address} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" rows="3" required />
                        </div>
                        <div className="mt-4">
                            <label className="block text-gray-700 font-semibold mb-2">Password *</label>
                            <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                        </div>
                        <button
                            type="submit"
                            className="w-full mt-6 bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                        >
                            Create Seller Account
                        </button>
                    </form>
                    <div className="mt-6 text-center">
                        <p className="text-gray-600">
                            Already have an account?{' '}
                            <button
                                onClick={() => onNavigate('sellerLogin')}
                                className="text-orange-500 font-semibold hover:underline"
                            >
                                Login
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: SellerDashboard ---
const SellerDashboard = ({ currentUser, onNavigate, onShowNotification }) => {
    
    const [stats, setStats] = useState({
        totalOrders: 0,
        totalRevenue: 0,
        totalDishes: 0,
        avgRating: 0
    });
    const [recentOrders, setRecentOrders] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [statsRes, ordersRes] = await Promise.all([
                    sellerAPI.getSellerStats(),
                    orderAPI.getSellerOrders()
                ]);
                setStats(statsRes.data);
                setRecentOrders(ordersRes.data.slice(0, 5));
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
                onShowNotification("Could not load dashboard data.");
            }
        };
        fetchDashboardData();
    }, [onShowNotification]);

    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Seller Dashboard</h1>
                    <p className="text-gray-600 mt-2">Welcome, {currentUser?.name}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6 text-center hover:shadow-xl transition transform hover:-translate-y-1">
                        <Package className="w-12 h-12 mx-auto text-orange-500 mb-3" />
                        <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2">Total Orders</h3>
                        <p className="text-2xl md:text-3xl font-bold text-orange-500">{stats.totalOrders}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6 text-center hover:shadow-xl transition transform hover:-translate-y-1">
                        <DollarSign className="w-12 h-12 mx-auto text-orange-500 mb-3" />
                        <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2">Revenue</h3>
                        <p className="text-2xl md:text-3xl font-bold text-orange-500">₹{stats.totalRevenue}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6 text-center hover:shadow-xl transition transform hover:-translate-y-1">
                        <TrendingUp className="w-12 h-12 mx-auto text-orange-500 mb-3" />
                        <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2">Total Dishes</h3>
                        <p className="text-2xl md:text-3xl font-bold text-orange-500">{stats.totalDishes}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6 text-center hover:shadow-xl transition transform hover:-translate-y-1">
                        <Star className="w-12 h-12 mx-auto text-orange-500 mb-3" />
                        <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2">Avg Rating</h3>
                        <p className="text-2xl md:text-3xl font-bold text-orange-500">{stats.avgRating} ⭐</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-8">
                    <h3 className="text-xl md:text-2xl font-bold text-orange-500 mb-6">Recent Orders</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-orange-500 text-white">
                                    <th className="px-4 py-3 text-left">Order ID</th>
                                    <th className="px-4 py-3 text-left">Customer</th>
                                    <th className="px-4 py-3 text-left">Items</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map(order => (
                                    <tr key={order._id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3">{order._id.slice(-6)}</td>
                                        <td className="px-4 py-3">{order.customerId?.name || 'Customer'}</td>
                                        <td className="px-4 py-3">{order.items.map(i => i.name).join(', ')}</td>
                                        <td className="px-4 py-3">
                                            <span className={`font-bold ${order.status === 'delivered' ? 'text-green-500' :
                                                order.status === 'preparing' ? 'text-orange-500' :
                                                    'text-blue-500'
                                                }`}>
                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <button
                        onClick={() => onNavigate('addDish')}
                        className="bg-orange-500 text-white p-6 md:p-8 rounded-xl shadow-lg hover:bg-orange-600 transition text-lg md:text-xl font-bold"
                    >
                        + Add New Dish
                    </button>
                    <button
                        onClick={() => onNavigate('sellerOrders')}
                        className="bg-gray-800 text-white p-6 md:p-8 rounded-xl shadow-lg hover:bg-gray-700 transition text-lg md:text-xl font-bold"
                    >
                        View All Orders
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: AddDishPage (With File Upload) ---
const AddDishPage = ({ onDishAdded, onShowNotification }) => {
    
    const [imageFile, setImageFile] = useState(null);
    const [dishData, setDishData] = useState({
        name: '', price: '', type: '', description: '', category: '', prepTime: '',
    });

    const handleTextChange = (e) => {
        setDishData({ ...dishData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        setImageFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!imageFile) {
            onShowNotification("Please upload an image for the dish.");
            return;
        }

        const formData = new FormData();
        formData.append('name', dishData.name);
        formData.append('price', dishData.price);
        formData.append('type', dishData.type);
        formData.append('description', dishData.description);
        formData.append('category', dishData.category);
        formData.append('prepTime', dishData.prepTime);
        formData.append('imageFile', imageFile); // This key must match server.js
        
        try {
            await dishAPI.createDish(formData);
            onDishAdded(); // This calls fetchDishes() & navigates
        } catch (error) {
            console.error("Error creating dish:", error);
            onShowNotification("Error: Could not add dish.");
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen py-8 md:py-12">
            <div className="container mx-auto px-4 md:px-6 max-w-2xl">
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-orange-500 text-center mb-6">Add New Dish</h2>
                    <form onSubmit={handleSubmit}>
                        
                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Dish Image *</label>
                            <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-orange-500 transition">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="imageUpload"
                                    required
                                />
                                <label htmlFor="imageUpload" className="cursor-pointer block text-orange-500 font-semibold">
                                    {imageFile ? `File: ${imageFile.name}` : 'Click to Upload Image'}
                                </label>
                                <p className="text-sm text-gray-500 mt-1">PNG, JPG, or JPEG</p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Dish Name *</label>
                            <input type="text" name="name" value={dishData.name} onChange={handleTextChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Description</label>
                            <textarea name="description" value={dishData.description} onChange={handleTextChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" rows="3" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Price (₹) *</label>
                                <input type="number" name="price" value={dishData.price} onChange={handleTextChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Type *</label>
                                <select name="type" value={dishData.type} onChange={handleTextChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required>
                                    <option value="">Select Type</option>
                                    <option value="veg">Vegetarian</option>
                                    <option value="non-veg">Non-Vegetarian</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Category *</label>
                                <select name="category" value={dishData.category} onChange={handleTextChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required>
                                    <option value="">Select Category</option>
                                    <option value="appetizer">Appetizer</option>
                                    <option value="main-course">Main Course</option>
                                    <option value="dessert">Dessert</option>
                                    <option value="beverage">Beverage</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Prep Time (min) *</label>
                                <input type="number" name="prepTime" value={dishData.prepTime} onChange={handleTextChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                        >
                            Add Dish
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: CheckoutPage ---
const CheckoutPage = ({ cart, cartTotal, onPlaceOrder, onShowNotification, onNavigate }) => {
    const [orderData, setOrderData] = useState({
        address: '',
        payment: 'cod', // Default to COD as payment gateway is removed
        instructions: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const sellerId = cart[0]?.sellerId._id;
        if (!sellerId) {
            onShowNotification("Error: Cart is empty or seller not found.");
            return;
        }

        const orderPayload = {
            items: cart.map(item => ({
                dishId: item._id,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            })),
            totalAmount: cartTotal, // We are not adding delivery fee here, but you could
            deliveryAddress: orderData.address,
            paymentMethod: orderData.payment,
            specialInstructions: orderData.instructions,
            sellerId: sellerId,
        };

        try {
            await orderAPI.createOrder(orderPayload);
            onPlaceOrder(); // This clears the cart
            onShowNotification('Order placed successfully!');
            onNavigate('customerOrders');
        } catch (error) {
            console.error("Error placing order:", error);
            onShowNotification("Error: Could not place order.");
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen py-12">
            <div className="container mx-auto px-6 max-w-2xl">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h2 className="text-3xl font-bold text-orange-500 text-center mb-6">Checkout</h2>
                    <div className="bg-gray-100 rounded-lg p-6 mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h3>
                        {cart.map(item => (
                            <div key={item.cartItemId} className="flex justify-between mb-2">
                                <span>{item.name} x {item.quantity}</span>
                                <span>₹{item.price * item.quantity}</span>
                            </div>
                        ))}
                        <hr className="my-3" />
                        <div className="flex justify-between text-xl font-bold">
                            <span>Total</span>
                            <span>₹{cartTotal}</span>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Delivery Address *</label>
                            <textarea
                                value={orderData.address}
                                onChange={(e) => setOrderData({ ...orderData, address: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                rows="3"
                                required
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Payment Method *</label>
                            <select
                                value={orderData.payment}
                                onChange={(e) => setOrderData({ ...orderData, payment: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                required
                            >
                                <option value="cod">Cash on Delivery</option>
                                {/* <option value="online">Online Payment (Disabled)</option> */}
                            </select>
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700 font-semibold mb-2">Special Instructions</label>
                            <textarea
                                value={orderData.instructions}
                                onChange={(e) => setOrderData({ ...orderData, instructions: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                                rows="2"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                        >
                            Place Order (₹{cartTotal})
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: SellerOrdersPage ---
const SellerOrdersPage = ({ onShowNotification }) => {
    
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchSellerOrders = async () => {
        setIsLoading(true);
        try {
            const response = await orderAPI.getSellerOrders();
            setOrders(response.data);
        } catch (error) {
            console.error("Error fetching seller orders:", error);
            onShowNotification("Could not load orders.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSellerOrders();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            await orderAPI.updateOrderStatus(orderId, newStatus);
            onShowNotification(`Order ${orderId.slice(-6)} updated to ${newStatus}`);
            fetchSellerOrders();
        } catch (error) {
            console.error("Error updating status:", error);
            onShowNotification("Error: Could not update status.");
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div className="container mx-auto px-4 md:px-6">
                <h2 className="text-2xl md:text-3xl font-bold text-orange-500 mb-6">All Orders</h2>
                {isLoading ? (
                    <div className="text-center py-12">Loading orders...</div>
                ) : (
                    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-orange-500 text-white">
                                    <th className="px-4 py-3 text-left">Order ID</th>
                                    <th className="px-4 py-3 text-left">Customer</th>
                                    <th className="px-4 py-3 text-left">Items</th>
                                    <th className="px-4 py-3 text-left">Instructions</th>
                                    <th className="px-4 py-3 text-left">Amount</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-left">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <tr key={order._id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3">{order._id.slice(-6)}</td>
                                        <td className="px-4 py-3">
                                            {order.customerId?.name || 'N/A'}<br />
                                            <small className="text-gray-500">{order.customerId?.phone || 'N/A'}</small>
                                        </td>
                                        <td className="px-4 py-3">{order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}</td>
                                        <td className="px-4 py-3">
                                            {order.specialInstructions
                                                ? <span className='text-red-600 italic font-medium'>{order.specialInstructions}</span>
                                                : <span className='text-gray-500'>None</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 font-semibold">₹{order.totalAmount}</td>
                                        <td className="px-4 py-3">
                                            <span className={`font-bold ${order.status === 'delivered' ? 'text-green-500' :
                                                order.status === 'preparing' ? 'text-orange-500' :
                                                    'text-blue-500'
                                                }`}>
                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {order.status === 'new' && (
                                                <button
                                                    onClick={() => handleUpdateStatus(order._id, 'preparing')}
                                                    className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600"
                                                >
                                                    Accept
                                                </button>
                                            )}
                                            {order.status === 'preparing' && (
                                                <button
                                                    onClick={() => handleUpdateStatus(order._id, 'ready-for-delivery')}
                                                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                                                >
                                                    Ready for Delivery
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENT: CustomerOrdersPage (With Review Button) ---
const CustomerOrdersPage = ({ onShowNotification, onReviewOrder }) => {

    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCustomerOrders = async () => {
            setIsLoading(true);
            try {
                const response = await orderAPI.getCustomerOrders();
                setOrders(response.data);
            } catch (error) {
                console.error("Error fetching customer orders:", error);
                onShowNotification("Could not load your orders.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchCustomerOrders();
    }, [onShowNotification]);

    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div className="container mx-auto px-4 md:px-6">
                <h2 className="text-2xl md:text-3xl font-bold text-orange-500 mb-6">Your Order History</h2>
                {isLoading ? (
                    <div className="text-center py-12">Loading your orders...</div>
                ) : (
                    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 space-y-4">
                        {orders.map(order => (
                            <div key={order._id} className='p-4 border border-gray-200 rounded-lg'>
                                <div className='flex justify-between items-center border-b pb-2 mb-2'>
                                    <span className='font-bold text-lg'>Order #{order._id.slice(-6)}</span>
                                    <span className={`font-bold text-sm p-1 rounded ${order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                        order.status === 'preparing' ? 'bg-orange-100 text-orange-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                    </span>
                                </div>
                                <p className='text-gray-700'>{order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}</p>
                                <p className='text-gray-900 font-semibold'>Total: ₹{order.totalAmount}</p>
                                {order.specialInstructions && <p className='text-xs italic text-gray-500'>Instructions: {order.specialInstructions}</p>}
                                <OrderTrackingCard order={order} />
                                
                                {order.status === 'delivered' && (
                                    <button 
                                        onClick={() => onReviewOrder(order)} // Pass the full order
                                        className="mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition text-sm"
                                    >
                                        Write a Review
                                    </button>
                                )}
                            </div>
                        ))}
                        {orders.length === 0 && (
                            <p className='text-center text-gray-500 py-8'>You haven't placed any orders yet.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- NEW COMPONENT: AddReviewPage ---
const AddReviewPage = ({ order, onBack, onShowNotification }) => {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        
        try {
            await reviewAPI.createReview({ 
                orderId: order._id, 
                sellerId: order.sellerId,
                rating, 
                comment 
            });
            onShowNotification('Review submitted! Thank you.');
            onBack(); // Go back to the orders page
        } catch (error) {
            console.error("Error submitting review:", error);
            onShowNotification(error.response?.data?.error || "Failed to submit review.");
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div className="container mx-auto px-4 md:px-6 max-w-lg">
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-2xl font-bold text-orange-500 mb-4">Write a Review</h2>
                    <p className="text-gray-600 mb-4">Reviewing order #{order._id.slice(-6)}</p>
                    <form onSubmit={handleSubmitReview}>
                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Rating (1-5)</label>
                            <select 
                                value={rating} 
                                onChange={(e) => setRating(Number(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value={5}>5 Stars (Excellent)</option>
                                <option value={4}>4 Stars (Good)</option>
                                <option value={3}>3 Stars (Average)</option>
                                <option value={2}>2 Stars (Poor)</option>
                                <option value={1}>1 Star (Bad)</option>
                            </select>
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700 font-semibold mb-2">Comment</label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                rows="4"
                                placeholder="Tell us about your experience..."
                            />
                        </div>
                        <button type="submit" className="w-full bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600">
                            Submit Review
                        </button>
                        <button type="button" onClick={onBack} className="w-full mt-2 text-center text-gray-600 hover:text-black">
                            Cancel
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: SellerAboutPage (With Logo Upload & Real Reviews) ---
const SellerAboutPage = ({ currentUser, onShowNotification }) => {
    
    const [logoFile, setLogoFile] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch seller reviews
    useEffect(() => {
        if (currentUser?.id) {
            const fetchReviews = async () => {
                setIsLoading(true);
                try {
                    const response = await reviewAPI.getSellerReviews(currentUser.id);
                    setReviews(response.data);
                } catch (error) {
                    console.error("Error fetching reviews:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchReviews();
        }
    }, [currentUser]);

    const handleLogoFileChange = (e) => {
        setLogoFile(e.target.files[0]);
    };

    const handleLogoUpload = async (e) => {
        e.preventDefault();
        if (!logoFile) {
            onShowNotification("Please select a logo file.");
            return;
        }

        const formData = new FormData();
        formData.append('logoFile', logoFile);

        try {
            await sellerAPI.updateLogo(formData);
            onShowNotification("Logo updated! (You may need to refresh)");
            setLogoFile(null);
        } catch (error) {
            console.error("Error uploading logo:", error);
            onShowNotification("Failed to upload logo.");
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div className="container mx-auto px-4 md:px-6">
                <h2 className="text-2xl md:text-3xl font-bold text-orange-500 mb-6">Restaurant Profile</h2>
                
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h3 className="text-xl font-bold text-orange-500 mb-4">About Our Restaurant</h3>
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        {/* Logo Display */}
                        <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 overflow-hidden">
                            {currentUser?.logoUrl ? (
                                <img src={currentUser.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <span className="font-bold">No Logo</span>
                            )}
                        </div>
                        {/* Details */}
                        <div className="flex-1">
                            <h4 className="text-xl font-bold mb-2">{currentUser?.businessName}</h4>
                            <p className="text-gray-700 mb-3">Authentic Indian cuisine with modern twist.</p>
                            <p className="mb-2"><strong>Email:</strong> {currentUser?.email}</p>
                            <p className="mb-2"><strong>Hours:</strong> 9:00 AM - 11:00 PM</p>
                        </div>
                        {/* Logo Upload Form */}
                        <form onSubmit={handleLogoUpload} className="w-full md:w-auto">
                            <label className="block text-gray-700 font-semibold mb-2">Upload Logo</label>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleLogoFileChange}
                                className="text-sm"
                            />
                            <button type="submit" className="mt-2 w-full bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600">
                                Upload
                            </button>
                        </form>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-orange-500 mb-4">Customer Reviews</h3>
                    <div className="space-y-4">
                        {isLoading && <p>Loading reviews...</p>}
                        {!isLoading && reviews.length === 0 && (
                            <p className="text-gray-500 italic text-center">No reviews yet.</p>
                        )}
                        {!isLoading && reviews.map(review => (
                            <div key={review._id} className="border-l-4 border-orange-500 pl-4 py-3 bg-gray-50">
                                <div className="flex justify-between mb-2">
                                    <strong>{review.customerId?.name || 'Customer'}</strong>
                                    <span className="text-yellow-500">{'★'.repeat(review.rating)}</span>
                                </div>
                                <p className="text-gray-700 mb-2">"{review.comment}"</p>
                                <small className="text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</small>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: CustomerSellerAboutPage (Info for Customers) ---
const CustomerSellerAboutPage = () => (
    <div className="bg-gray-100 min-h-screen py-8">
        {/* ... (This page is static and doesn't need changes) ... */}
    </div>
);

// --- COMPONENT: Footer ---
const Footer = () => (
    <footer className="bg-orange-500 text-white py-12 mt-12">
        <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                    <h2 className="text-3xl font-bold">Home</h2>
                    <h2 className="text-3xl font-bold">Plate</h2>
                </div>
                <div className="text-center md:text-right">
                    <h3 className="text-xl font-bold mb-2">Contact and support</h3>
                    <p>📞 +91 9876543210</p>
                    <p>📧 support@homeplate.com</p>
                </div>
            </div>
        </div>
    </footer>
);


// ------------------------------------------------------------------
// --- MAIN APP COMPONENT ---
// ------------------------------------------------------------------

function App() {
    // --- STATE ---
    const [currentPage, setCurrentPage] = useState('home');
    const [cart, setCart] = useState([]);
    const [dishes, setDishes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [currentUser, setCurrentUser] = useState(null);
    const [notification, setNotification] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectedDishId, setSelectedDishId] = useState(null);
    const [orderToReview, setOrderToReview] = useState(null); // For review flow

    // --- GLOBAL DATA FETCHING ---
    const fetchDishes = async () => {
        try {
            setIsLoading(true);
            const response = await dishAPI.getAllDishes();
            setDishes(response.data);
        } catch (error) {
            console.error("Error fetching dishes:", error);
            showNotification('Error: Could not load dishes.');
        } finally {
            setIsLoading(false);
        }
    };

    // --- AUTHENTICATION ---
    useEffect(() => {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('currentUser');
        const savedCart = localStorage.getItem('homeplateCart');
        if (token && user) {
            setCurrentUser(JSON.parse(user));
        }
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch {
                localStorage.removeItem('homeplateCart');
            }
        }
        fetchDishes();
    }, []);

    useEffect(() => {
        localStorage.setItem('homeplateCart', JSON.stringify(cart));
    }, [cart]);

    const handleLoginSuccess = (user, token) => {
        const userWithType = { ...user, userType: user.userType || (user.businessName ? 'seller' : 'customer') };
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(userWithType));
        setCurrentUser(userWithType);
        
        if (userWithType.userType === 'seller') {
            setCurrentPage('sellerDashboard');
        } else if (userWithType.userType === 'delivery') {
            setCurrentPage('deliveryDashboard');
        } else {
            setCurrentPage('home');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
        setCurrentPage('home');
        setMobileMenuOpen(false);
        showNotification('Logged out successfully');
    };

    // --- HELPER FUNCTIONS ---
    const showNotification = (message) => {
        setNotification(message);
        setTimeout(() => setNotification(''), 3000);
    };

    // --- CART FUNCTIONS ---
    const addToCart = (dish, quantity = 1, instructions = '') => {
        if (!currentUser || currentUser.userType !== 'customer') {
            showNotification('Please log in as a customer before adding food to your cart.');
            setCurrentPage('customerLogin');
            return;
        }
        const dishSellerId = String(dish.sellerId?._id || dish.sellerId);
        const cartSellerId = cart.length ? String(cart[0].sellerId?._id || cart[0].sellerId) : null;
        if (cartSellerId && cartSellerId !== dishSellerId) {
            showNotification('Please place the current kitchen order before adding dishes from another kitchen.');
            return;
        }
        const cartItemId = `${dish._id}-${Date.now()}`; 
        const existingItem = cart.find(item => item._id === dish._id && item.instructions === instructions);

        if (existingItem) {
            setCart(cart.map(item =>
                item._id === dish._id && item.instructions === instructions ? { ...item, quantity: item.quantity + quantity } : item
            ));
        } else {
            setCart([...cart, { ...dish, cartItemId: cartItemId, quantity, instructions }]);
        }
        showNotification(`Added ${dish.name} to cart!`);
        setCurrentPage('menu');
    };

    const removeFromCart = (cartItemId) => {
        setCart(cart.filter(item => item.cartItemId !== cartItemId));
    };

    const updateQuantity = (cartItemId, change) => {
        const item = cart.find(item => item.cartItemId === cartItemId);
        if (item) {
            const newQuantity = item.quantity + change;
            if (newQuantity <= 0) {
                removeFromCart(cartItemId);
            } else {
                setCart(cart.map(item =>
                    item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item
                ));
            }
        }
    };
    
    const handlePlaceOrder = () => {
        setCart([]);
        localStorage.removeItem('homeplateCart');
    };

    // --- NAVIGATION HANDLERS ---
    const handleNavigate = (page) => {
        const protectedPages = {
            sellerDashboard: 'seller', addDish: 'seller', sellerOrders: 'seller', sellerAbout: 'seller',
            deliveryDashboard: 'delivery', customerOrders: 'customer', checkout: 'customer', cart: 'customer'
        };
        const requiredRole = protectedPages[page];
        if (requiredRole && (!currentUser || currentUser.userType !== requiredRole)) {
            showNotification(`Please log in as a ${requiredRole === 'delivery' ? 'delivery partner' : requiredRole} first.`);
            setCurrentPage(requiredRole === 'seller' ? 'sellerLogin' : requiredRole === 'delivery' ? 'deliveryLogin' : 'customerLogin');
            setMobileMenuOpen(false);
            return;
        }
        setCurrentPage(page);
        setMobileMenuOpen(false);
    };

    const handleViewDetails = (dish) => {
        setSelectedDishId(dish._id);
        setCurrentPage('dishDetail');
    };
    
    const handleDishAdded = () => {
        showNotification('Dish added successfully!');
        fetchDishes();
        setCurrentPage('sellerDashboard');
    };
    
    // For Review Flow
    const handleReviewOrder = (order) => {
        setOrderToReview(order);
        setCurrentPage('addReview');
    };

    // --- DERIVED STATE ---
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const filteredDishes = dishes.filter(dish => {
        const matchesSearch = dish.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dish.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || dish.type === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const selectedDish = dishes.find(d => d._id === selectedDishId);

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-gray-100">
            {notification && (
                <div className="fixed top-4 right-4 bg-green-500 text-white px-4 md:px-6 py-3 rounded-lg shadow-lg z-[60] animate-slideIn text-sm md:text-base">
                    {notification}
                </div>
            )}

            {currentUser?.userType === 'seller' ? (
                <SellerHeader
                    currentUser={currentUser}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    mobileMenuOpen={mobileMenuOpen}
                    onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
                />
            ) : currentUser?.userType === 'delivery' ? (
                <DeliveryHeader currentUser={currentUser} onNavigate={handleNavigate} onLogout={handleLogout} />
            ) : (
                <CustomerHeader
                    currentUser={currentUser}
                    cartCount={cartCount}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    mobileMenuOpen={mobileMenuOpen}
                    onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
                />
            )}

            {/* --- Main Content Routing --- */}
            {currentPage === 'home' && (
                <HomePage
                    onNavigate={handleNavigate}
                    dishes={dishes}
                    cart={cart}
                    onViewDetails={handleViewDetails}
                />
            )}
            {currentPage === 'menu' && (
                <MenuPage
                    filteredDishes={filteredDishes}
                    categoryFilter={categoryFilter}
                    onCategoryChange={setCategoryFilter}
                    onViewDetails={handleViewDetails}
                    isLoading={isLoading}
                />
            )}
            {currentPage === 'cart' && (
                <CartPage
                    cart={cart}
                    cartTotal={cartTotal}
                    onUpdateQuantity={updateQuantity}
                    onRemoveFromCart={removeFromCart}
                    onNavigate={handleNavigate}
                />
            )}
            {currentPage === 'customerLogin' && (
                <CustomerLoginPage
                    onLoginSuccess={handleLoginSuccess}
                    onShowNotification={showNotification}
                />
            )}
            {currentPage === 'loginChoice' && (
                <LoginChoicePage onNavigate={handleNavigate} />
            )}
            {currentPage === 'sellerLogin' && (
                <SellerLoginPage
                    onLoginSuccess={handleLoginSuccess}
                    onShowNotification={showNotification}
                    onNavigate={handleNavigate}
                />
            )}
            {currentPage === 'deliveryLogin' && (
                <DeliveryLoginPage onLoginSuccess={handleLoginSuccess} onShowNotification={showNotification} />
            )}
            {currentPage === 'deliveryDashboard' && (
                <DeliveryDashboard onShowNotification={showNotification} />
            )}
            {currentPage === 'sellerSignup' && (
                <SellerSignupPage
                    onShowNotification={showNotification}
                    onNavigate={handleNavigate}
                />
            )}
            {currentPage === 'sellerDashboard' && (
                <SellerDashboard
                    currentUser={currentUser}
                    onNavigate={handleNavigate}
                    onShowNotification={showNotification}
                />
            )}
            {currentPage === 'addDish' && (
                <AddDishPage
                    onDishAdded={handleDishAdded}
                    onShowNotification={showNotification}
                />
            )}
            {currentPage === 'sellerOrders' && (
                <SellerOrdersPage
                    onShowNotification={showNotification}
                />
            )}
            {currentPage === 'sellerAbout' && (
                <SellerAboutPage 
                    currentUser={currentUser}
                    onShowNotification={showNotification}
                />
            )}
            {currentPage === 'checkout' && (
                <CheckoutPage
                    cart={cart}
                    cartTotal={cartTotal}
                    onPlaceOrder={handlePlaceOrder}
                    onShowNotification={showNotification}
                    onNavigate={handleNavigate}
                />
            )}
            {currentPage === 'customerOrders' && (
                <CustomerOrdersPage
                    onShowNotification={showNotification}
                    onReviewOrder={handleReviewOrder}
                />
            )}
            {currentPage === 'addReview' && (
                <AddReviewPage
                    order={orderToReview}
                    onBack={() => handleNavigate('customerOrders')}
                    onShowNotification={showNotification}
                />
            )}
            {currentPage === 'dishDetail' && (
                <DishDetailPage
                    dish={selectedDish}
                    onAddToCart={addToCart}
                    onBack={() => handleNavigate('menu')}
                />
            )}

            <Footer />

            {/* --- CHATBOT (Request #5) --- */}
            {/* Renders on all pages if logged in */}
            {currentUser && <Chatbot />}

            <style>{`
                @keyframes slideIn {
                  from { transform: translateX(100%); }
                  to { transform: translateX(0); }
                }
                .animate-slideIn {
                  animation: slideIn 0.3s ease;
                }
            `}</style>
        </div>
    );
}

export default App;
