require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require("socket.io");
const nodemailer = require('nodemailer'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// সিক্রেট কি
const SECRET_KEY = process.env.SECRET_KEY || "mysecretkey123"; 

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ==================================================
// 👇 ডাটাবেস কানেকশন (সঠিক নিয়ম: একবারই কানেক্ট হবে)
// ==================================================

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/socialApp';

// ডিবাগিং: কনসোলে চেক করা যে লিংকটি ঠিকমতো লোড হয়েছে কিনা
if (!mongoURI) {
    console.error("❌ Fatal Error: MONGO_URI is missing in Environment Variables!");
} else {
    // পাসওয়ার্ড লুকিয়ে প্রিন্ট করা (সিকিউরিটির জন্য)
    const hiddenURI = mongoURI.replace(/:([^:@]+)@/, ':****@');
    console.log(`✅ MONGO_URI found: ${hiddenURI}`);
    console.log("🔄 Connecting to MongoDB...");
}

// কানেকশন ফাংশন
mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000 // ৫ সেকেন্ড চেষ্টা করবে
})
.then(() => console.log("✅ MongoDB Connected Successfully!"))
.catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    // যদি অথেনটিকেশন এরর হয়, তবে বিস্তারিত দেখাবে
    if (err.message.includes('auth')) {
        console.error("💡 টিপস: আপনার ইউজারনেম বা পাসওয়ার্ড ভুল হতে পারে। Render Environment চেক করুন।");
    }
});


// ১. ইউজার স্কিমা (OTP বাদ দেওয়া হয়েছে)
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, default: "" },
    mobile: { type: String, default: "" },
    birthday: { type: Date },
    profilePic: { type: String, default: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" },
    coverPic: { type: String, default: "" },
    bio: { type: String, default: "Welcome to my profile!" },
    coins: { type: Number, default: 50 }, // সাইন আপ বোনাস
    following: [{ type: String }],
    followers: [{ type: String }],
    blockedUsers: [{ type: String }]
});
const User = mongoose.model('User', UserSchema);

// ২. পোস্ট স্কিমা
const PostSchema = new mongoose.Schema({
    username: String,
    mediaType: String,
    mediaUrl: String,
    caption: { type: String, default: "" },
    location: { type: String, default: "" },
    privacy: { type: String, default: 'public' },
    coins: { type: Number, default: 0 },
    coinedBy: [{ type: String }],
    watchedBy: [{ type: String }], // Watch to Earn
    comments: [{
        _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
        user: String,
        text: String,
        likes: { type: Number, default: 0 },
        replies: [{ user: String, text: String, createdAt: { type: Date, default: Date.now } }]
    }],
    isShort: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

// ৩. মেসেজ স্কিমা
const MessageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    text: String,
    mediaUrl: String,
    mediaType: String,
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// ৪. নোটিফিকেশন স্কিমা
const NotificationSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    type: String,
    message: String,
    postId: String,
    seen: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', NotificationSchema);

// ৫. রিপোর্ট স্কিমা
const ReportSchema = new mongoose.Schema({
    reporter: String,
    reportedId: String,
    reason: String,
    type: String,
    createdAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', ReportSchema);

// --- নতুন ফাইল আপলোড কনফিগারেশন (Cloudinary) ---
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ১. Cloudinary কনফিগার করা
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

// ২. স্টোরেজ সেটআপ (অটোমেটিক ক্লাউডে আপলোড হবে)
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'fun-earn-uploads', // ক্লাউডিনারি ফোল্ডারের নাম
        allowed_formats: ['jpg', 'png', 'jpeg', 'mp4', 'webm'], // কি কি ফাইল নেওয়া হবে
        resource_type: 'auto' // ছবি বা ভিডিও অটো ডিটেক্ট করবে
    },
});

const upload = multer({ storage: storage });

// ==========================================
// Socket.io (রিয়েল-টাইম ফিচার)
// ==========================================
io.on('connection', (socket) => {
    // মেসেজ পাঠানো
    socket.on('send_message', async (data) => {
        const newMsg = new Message(data);
        await newMsg.save();
        io.emit('receive_message', data);

        const msgText = data.mediaUrl ? (data.mediaType === 'video' ? 'একটি ভিডিও পাঠিয়েছেন 🎥' : 'একটি ছবি পাঠিয়েছেন 📷') : 'আপনাকে মেসেজ পাঠিয়েছেন।';
        io.emit('new_notification', {
            sender: data.sender, receiver: data.receiver, type: 'message',
            message: `${data.sender} ${msgText}`, postId: null
        });
    });

    // লাইভ নোটিফিকেশন
    socket.on('start_live_stream', (data) => {
        socket.join(data.username);
        io.emit('user_is_live', { username: data.username });
    });
    socket.on('stream_data', (data) => {
        socket.to(data.room).emit('stream_feed', data.image);
    });
    socket.on('join_live_room', (roomName) => { socket.join(roomName); });
    socket.on('send_live_comment', (data) => {
        io.to(data.room).emit('receive_live_comment', data);
    });
});

// ==========================================
// API Routes (অথেনটিকেশন - OTP ছাড়া)
// ==========================================

// ১. সহজ রেজিস্ট্রেশন
app.post('/register', async (req, res) => {
    try {
        const { username, password, identifier, type, birthday } = req.body;

        // চেক করা ইউজার আগে আছে কিনা
        const query = type === 'email' ? { email: identifier } : { mobile: identifier };
        // ইউজারনেম অথবা ইমেইল/ফোন চেক
        const exist = await User.findOne({ $or: [query, { username: username }] });
        
        if (exist) {
            return res.json({ success: false, message: "এই ইউজারনেম বা ফোন/ইমেইল ইতিমধ্যে ব্যবহৃত হয়েছে!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
            username: username,
            password: hashedPassword,
            birthday: new Date(birthday),
            email: type === 'email' ? identifier : "",
            mobile: type === 'mobile' ? identifier : "",
            coins: 50 // নতুন ইউজারকে বোনাস
        });

        await newUser.save();
        res.json({ success: true, message: "একাউন্ট তৈরি সফল! এখন লগিন করুন।" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "রেজিস্ট্রেশন সমস্যা" });
    }
});

// ২. সহজ লগিন
app.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // ইউজারনেম, ইমেইল বা ফোন দিয়ে খোঁজা
        const user = await User.findOne({ 
            $or: [{ email: identifier }, { mobile: identifier }, { username: identifier }] 
        });

        if (!user) return res.json({ success: false, message: "ইউজার পাওয়া যায়নি!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.json({ success: false, message: "ভুল পাসওয়ার্ড!" });

        const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);

        res.json({
            success: true,
            token,
            username: user.username,
            profilePic: user.profilePic,
            coins: user.coins || 0,
            mobile: user.mobile || "",
            message: "লগিন সফল!"
        });
    } catch (err) {
        res.status(500).json({ error: "লগিন সমস্যা" });
    }
});

// ==========================================
// অন্যান্য API Routes
// ==========================================

// --- ৩. পোস্ট আপলোড রাউট (Cloudinary আপডেটেড) ---
app.post('/upload', upload.single('mediaFile'), async (req, res) => {
    try {
        const { username, isShort, caption, location, privacy } = req.body;
        const isShortBoolean = isShort === 'true' || isShort === true || isShort === 'on';

        if (!req.file && !caption) {
            return res.status(400).json({ error: "ফাইল অথবা ক্যাপশন দিন।" });
        }

        // 👇 Cloudinary সরাসরি ফাইলের পূর্ণ লিংক (path) দেয়
        const mediaUrl = req.file ? req.file.path : '';
        const fileType = req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : '';
        
        const newPost = new Post({
            username,
            mediaType: fileType,
            mediaUrl: mediaUrl, // সরাসরি ক্লাউড লিংক
            isShort: isShortBoolean,
            caption: caption || '',
            location: location || '',
            privacy: privacy || 'public'
        });

        await newPost.save();

        // নোটিফিকেশন
        const notifMsg = isShortBoolean ? 'একটি রিলস' : 'একটি নতুন পোস্ট';
        if (typeof io !== 'undefined') {
            io.emit('new_notification', {
                sender: username, receiver: 'all', type: 'upload',
                message: `${username} ${notifMsg} আপলোড করেছেন।`, postId: newPost._id
            });
        }
        
        res.json({ success: true, message: "Upload Successful", post: newPost });
    } catch (err) {
        console.error("Upload Error Details:", JSON.stringify(err, null, 2)); 
        console.error("Message:", err.message);
    
        res.status(500).json({ error: "আপলোড সমস্যা: " + err.message });
    }
});

// প্রোফাইল আপডেটের রাউটও একই ভাবে req.file.path ব্যবহার করবে
app.post('/update-profile-data', upload.fields([{ name: 'profilePic' }, { name: 'coverPic' }]), async (req, res) => {
    try {
        const { username, bio } = req.body;
        let updateData = {};
        if (bio) updateData.bio = bio;

        // 👇 Cloudinary লিংক ব্যবহার
        if (req.files['profilePic']) {
            updateData.profilePic = req.files['profilePic'][0].path;
        }
        if (req.files['coverPic']) {
            updateData.coverPic = req.files['coverPic'][0].path;
        }

        const user = await User.findOneAndUpdate({ username }, { $set: updateData }, { new: true });
        
        res.json({ 
            success: true, message: "আপডেট হয়েছে!", 
            profilePic: user.profilePic, coverPic: user.coverPic, bio: user.bio 
        });
    } catch (err) { 
        console.error("Upload Error Details:", JSON.stringify(err, null, 2)); 
        console.error("Message:", err.message);
    
        res.status(500).json({ error: "আপলোড সমস্যা: " + err.message });
    }
});
// ৪. চ্যাট ফাইল আপলোড
app.post('/chat-upload', upload.single('chatFile'), (req, res) => {
    if (req.file) {
        const fileType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
        res.json({ success: true, mediaUrl: `/uploads/${req.file.filename}`, mediaType: fileType });
    } else {
        res.status(400).json({ error: "ফাইল আপলোড হয়নি" });
    }
});

// ৫. প্রোফাইল আপডেট (ফটো + কভার + বায়ো)
app.post('/update-profile-data', upload.fields([{ name: 'profilePic' }, { name: 'coverPic' }]), async (req, res) => {
    try {
        const { username, bio } = req.body;
        let updateData = {};
        if (bio) updateData.bio = bio;
        if (req.files['profilePic']) updateData.profilePic = `/uploads/${req.files['profilePic'][0].filename}`;
        if (req.files['coverPic']) updateData.coverPic = `/uploads/${req.files['coverPic'][0].filename}`;

        const user = await User.findOneAndUpdate({ username }, { $set: updateData }, { new: true });
        res.json({ success: true, message: "প্রোফাইল আপডেট হয়েছে!", profilePic: user.profilePic, coverPic: user.coverPic, bio: user.bio });
    } catch (err) { res.status(500).json({ error: "সমস্যা" }); }
});

// ৬. ফলো/কানেক্ট
app.post('/connect-user', async (req, res) => {
    try {
        const { sender, receiver } = req.body;
        if(sender === receiver) return res.json({ message: "নিজেকে ফলো করা যায় না!" });

        const me = await User.findOne({ username: sender });
        const targetUser = await User.findOne({ username: receiver });

        if (!me || !targetUser) return res.status(404).json({ message: "ইউজার নেই" });
        if(me.following.includes(receiver)) return res.json({ message: "ইতিমধ্যে ফলো করছেন" });

        me.following.push(receiver);
        targetUser.followers.push(sender);
        me.coins = (me.coins || 0) + 5; // ফলো বোনাস

        await me.save();
        await targetUser.save();

        io.emit('new_notification', {
            sender: sender, receiver: receiver, type: 'message', 
            message: `${sender} আপনাকে ফলো করেছেন!`, postId: null
        });
        res.json({ success: true, message: "ফলো সফল!", newCoins: me.coins });
    } catch (err) { res.status(500).json({ error: "সমস্যা" }); }
});

// ৭. আনফলো
app.post('/unconnect-user', async (req, res) => {
    try {
        const { sender, targetUser } = req.body;
        const me = await User.findOne({ username: sender });
        const target = await User.findOne({ username: targetUser });

        me.following = me.following.filter(u => u !== targetUser);
        target.followers = target.followers.filter(u => u !== sender);
        
        if (me.coins >= 5) me.coins -= 5; else me.coins = 0; // আনফলো পেনাল্টি

        await me.save();
        await target.save();
        res.json({ success: true, message: "আনফলো করা হয়েছে", newCoins: me.coins });
    } catch (err) { res.status(500).json({ error: "সমস্যা" }); }
});

// ৮. কয়েন দেওয়া (গিফট)
app.post('/give-coin/:id', async (req, res) => {
    try {
        const { username } = req.body; 
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "পোস্ট নেই" });
        if (!post.coinedBy) post.coinedBy = [];
        if (!post.coins) post.coins = 0;

        if (post.coinedBy.includes(username)) return res.status(400).json({ error: "ইতিমধ্যে কয়েন দিয়েছেন" });

        const creator = await User.findOne({ username: post.username });
        const giver = await User.findOne({ username: username });

        if (creator) { creator.coins = (creator.coins || 0) + 5; await creator.save(); }
        if (giver) { giver.coins = (giver.coins || 0) + 1; await giver.save(); }

        post.coins += 1;
        post.coinedBy.push(username);
        await post.save();

        if (post.username !== username) {
            io.emit('new_notification', {
                sender: username, receiver: post.username, type: 'coin',
                message: `${username} আপনাকে কয়েন গিফট করেছেন! 🪙`, postId: post._id
            });
        }
        res.json({ message: "সফল!" });
    } catch (err) { res.status(500).json({ error: "সমস্যা" }); }
});

// ৯. ভিডিও দেখার রিওয়ার্ড
app.post('/watch-video/:id', async (req, res) => {
    try {
        const { username } = req.body; 
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "পোস্ট নেই" });
        if (!post.watchedBy) post.watchedBy = [];
        if (post.watchedBy.includes(username)) return res.json({ success: false });

        const creator = await User.findOne({ username: post.username });
        const viewer = await User.findOne({ username: username });

        if (viewer) { viewer.coins = (viewer.coins || 0) + 1; await viewer.save(); }
        if (creator && post.username !== username) { creator.coins = (creator.coins || 0) + 5; await creator.save(); }

        post.watchedBy.push(username);
        await post.save();
        res.json({ success: true, message: "১ কয়েন আর্ন হয়েছে!" });
    } catch (err) { res.status(500).json({ error: "সমস্যা" }); }
});

// ১০. শেয়ার রিওয়ার্ড
app.post('/reward-share', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (user) {
            user.coins = (user.coins || 0) + 5;
            await user.save();
            res.json({ success: true });
        }
    } catch (err) { res.status(500).json({ error: "সমস্যা" }); }
});

// ১১. অন্যান্য রাউটস
app.get('/posts', async (req, res) => { const posts = await Post.find().sort({ _id: -1 }); res.json(posts); });
app.get('/users', async (req, res) => { const users = await User.find({}, 'username profilePic bio coverPic following followers mobile'); res.json(users); });
app.get('/my-balance/:username', async (req, res) => { const user = await User.findOne({ username: req.params.username }); res.json({ coins: user ? user.coins : 0 }); });

app.post('/comment/:id', async (req, res) => {
    const { user, text } = req.body;
    const post = await Post.findById(req.params.id);
    post.comments.push({ user, text, likes: 0, replies: [] });
    await post.save();
    if (post.username !== user) {
        io.emit('new_notification', { sender: user, receiver: post.username, type: 'comment', message: `${user} কমেন্ট করেছেন: "${text}"`, postId: post._id });
    }
    res.json(post);
});

app.post('/like-comment/:postId/:commentId', async (req, res) => {
    const post = await Post.findById(req.params.postId);
    const comment = post.comments.id(req.params.commentId);
    if(comment) { comment.likes = (comment.likes||0)+1; await post.save(); res.json({success:true, likes:comment.likes}); }
});

app.post('/reply-comment/:postId/:commentId', async (req, res) => {
    const { user, text } = req.body;
    const post = await Post.findById(req.params.postId);
    const comment = post.comments.id(req.params.commentId);
    if(comment) { comment.replies.push({ user, text }); await post.save(); res.json({success:true}); }
});

app.post('/connect-by-phone', async (req, res) => {
    const { sender, mobile } = req.body;
    const target = await User.findOne({ mobile });
    const me = await User.findOne({ username: sender });
    if(!target) return res.json({ success: false, message: "নম্বর পাওয়া যায়নি" });
    if(me.following.includes(target.username)) return res.json({ success: false, message: "অলরেডি কানেক্টেড" });
    
    me.following.push(target.username);
    target.followers.push(sender);
    await me.save(); await target.save();
    res.json({ success: true, message: "কানেক্ট সফল!" });
});

// ১২. রিপোর্ট ও ব্লক
app.post('/report', async (req, res) => {
    const { reporter, reportedId, reason, type } = req.body;
    const newReport = new Report({ reporter, reportedId, reason, type });
    await newReport.save();
    res.json({ success: true, message: "রিপোর্ট জমা হয়েছে!" });
});

app.post('/block-user', async (req, res) => {
    const { username, blockedUser } = req.body;
    const user = await User.findOne({ username });
    if (!user.blockedUsers) user.blockedUsers = [];
    if (!user.blockedUsers.includes(blockedUser)) {
        user.blockedUsers.push(blockedUser);
        user.following = user.following.filter(u => u !== blockedUser);
        await user.save();
        res.json({ success: true, message: "ব্লক করা হয়েছে" });
    } else {
        res.json({ success: false, message: "অলরেডি ব্লকড" });
    }
});

// ১৩. চ্যাট ও গ্লোবাল সার্চ
app.get('/messages/:user1/:user2', async (req, res) => {
    const messages = await Message.find({ $or: [ { sender: req.params.user1, receiver: req.params.user2 }, { sender: req.params.user2, receiver: req.params.user1 } ] }).sort({ createdAt: 1 });
    res.json(messages);
});

app.get('/global-search/:query', async (req, res) => {
    const searchRegex = new RegExp(req.params.query, 'i');
    const users = await User.find({ username: searchRegex }).select('username profilePic');
    const posts = await Post.find({ caption: searchRegex }).sort({ _id: -1 });
    res.json({ users, posts });
});

// ১৪. পাসওয়ার্ড চেঞ্জ ও একাউন্ট ডিলিট
app.post('/change-password', async (req, res) => {
    const { username, oldPass, newPass } = req.body;
    const user = await User.findOne({ username });
    if (!await bcrypt.compare(oldPass, user.password)) return res.json({ success: false, message: "পুরনো পাসওয়ার্ড ভুল" });
    user.password = await bcrypt.hash(newPass, 10);
    await user.save();
    res.json({ success: true, message: "পাসওয়ার্ড আপডেট হয়েছে" });
});

app.post('/delete-my-account', async (req, res) => {
    const { username } = req.body;
    await User.findOneAndDelete({ username });
    await Post.deleteMany({ username });
    res.json({ success: true, message: "একাউন্ট ডিলিট হয়েছে" });
});

// ১৫. প্রাইভেসি পলিসি
app.get('/privacy-policy', (req, res) => {
    res.send(`<h1>Privacy Policy</h1><p>We respect your privacy. Contact us at support@funearn.com</p>`);
});

// হোম পেজ রুট
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// সার্ভার চালু
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});