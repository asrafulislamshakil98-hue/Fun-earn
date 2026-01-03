require('dotenv').config();
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require("socket.io");
// server.js এর Twilio অংশে

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_TOKEN;
const twilioClient = new twilio(accountSid, authToken);
const twilioPhone = process.env.TWILIO_PHONE; // .env ফাইল থেকে নম্বর আসবে

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const SECRET_KEY = "mysecretkey123"; 

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// --- ১. ফাইলের উপরের দিকে (MongoDB কানেকশন আপডেট) ---

// যদি অনলাইনে থাকে তো ওটা নিবে, না হলে লোকাল নিবে
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/socialApp';

mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));
// --- স্কিমা ডিজাইন ---
// server.js এ transporter আপডেট করুন

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,       // এই পোর্টটি জিমেইলের জন্য সবচেয়ে ভালো
    secure: true,    // 465 পোর্টের জন্য true দিতে হয়
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ১. রিপোর্ট স্কিমা (রিপোর্ট জমা রাখার জন্য)
const ReportSchema = new mongoose.Schema({
    reporter: String,       // কে রিপোর্ট করল
    reportedId: String,     // কোন পোস্ট বা ইউজারকে রিপোর্ট করল
    reason: String,         // কারণ
    type: String,           // 'post' or 'user'
    createdAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', ReportSchema);


// ১. ইউজার স্কিমা (আপডেট: ইমেইল, ফোন, বার্থডে, OTP)
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // ইউনিক নাম (যেমন: @shakil)
    email: { type: String, default: "" }, // ইমেইল
    mobile: { type: String, default: "" }, // ফোন নম্বর
    password: { type: String, required: true },
    birthday: { type: Date, required: true }, // জন্মতারিখ
    
    // OTP ভেরিফিকেশনের জন্য
    otp: { type: String, default: null },
    
    profilePic: { type: String, default: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" },
    coverPic: { type: String, default: "" },
    bio: { type: String, default: "Welcome to my profile!" },
    coins: { type: Number, default: 0 },
    following: [{ type: String }], 
    followers: [{ type: String }], 
    blockedUsers: [{ type: String }] // 👇 এই লাইনটি নতুন যোগ করুন 
});
const User = mongoose.model('User', UserSchema);

// ২. পোস্ট স্কিমা (আপডেট করা হয়েছে: লাইক ও রিপ্লাই সহ)
const PostSchema = new mongoose.Schema({
    username: String,
    mediaType: String,
    mediaUrl: String,
    caption: { type: String, default: "" },       
    location: { type: String, default: "" },      
    privacy: { type: String, default: 'public' }, 
    coins: { type: Number, default: 0 },
    coinedBy: [{ type: String }],
    watchedBy: [{ type: String }], 
    isShort: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },

    // 👇 নতুন কমেন্ট স্ট্রাকচার
    comments: [{
        _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
        user: String,
        text: String,
        likes: { type: Number, default: 0 },
        replies: [{ 
            user: String, 
            text: String, 
            createdAt: { type: Date, default: Date.now } 
        }]
    }]
});
const Post = mongoose.model('Post', PostSchema);

// ৩. মেসেজ স্কিমা
const MessageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    text: String,
    imageUrl: String,
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

// --- ফাইল আপলোড কনফিগারেশন ---
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb){
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ৩. চ্যাটের ছবি আপলোডের রাউট (API Routes সেকশনে যোগ করুন)
app.post('/chat-upload', upload.single('chatFile'), (req, res) => {
    if (req.file) {
        res.json({ success: true, imageUrl: `/uploads/${req.file.filename}` });
    } else {
        res.status(400).json({ error: "ফাইল আপলোড হয়নি" });
    }
});
// --- Socket.io ---
io.on('connection', (socket) => {
    socket.on('send_message', async (data) => {
        const newMsg = new Message(data);
        await newMsg.save();
        io.emit('receive_message', data);
        const msgText = data.imageUrl ? 'একটি ছবি পাঠিয়েছেন 📷' : 'আপনাকে মেসেজ পাঠিয়েছেন।';
        io.emit('new_notification', {
            sender: data.sender, receiver: data.receiver, type: 'message',
            message: `${data.sender} আপনাকে মেসেজ পাঠিয়েছেন।`, postId: null
        });
    });
    socket.on('start_live', (data) => {
        io.emit('new_notification', {
            sender: data.username, receiver: 'all', type: 'video',
            message: `🔴 ${data.username} এখন লাইভে আছেন!`, postId: null
        });
    });

    // server.js এর io.on('connection') এর ভেতরে যোগ করুন

    // ১. লাইভ শুরু (Broadcaster)
    socket.on('start_live_stream', (data) => {
        // রুম জয়েন করা
        socket.join(data.username);
        // সবাইকে জানানো যে এই ইউজার লাইভে আছে
        io.emit('user_is_live', { username: data.username });
    });

    // ২. ভিডিও ফ্রেম পাঠানো (Broadcaster -> Server -> Viewers)
    socket.on('stream_data', (data) => {
        // যারা এই রুমে (data.room) আছে তাদের কাছে ছবি পাঠানো
        socket.to(data.room).emit('stream_feed', data.image);
    });

    // ৩. দর্শক জয়েন করা (Viewer)
    socket.on('join_live_room', (roomName) => {
        socket.join(roomName);
    });

    // ৪. লাইভ কমেন্ট
    socket.on('send_live_comment', (data) => {
        io.to(data.room).emit('receive_live_comment', data);
    });
});

// --- API Routes ---

// --- ১. রেজিস্ট্রেশন রিকোয়েস্ট (OTP পাঠানো) ---
app.post('/register-request', async (req, res) => {
    try {
        const { identifier, type } = req.body; // type = 'email' or 'mobile'
        
        // চেক করা এই ইমেইল/ফোন আগে আছে কিনা
        const query = type === 'email' ? { email: identifier } : { mobile: identifier };
        const exist = await User.findOne(query);
        if (exist) return res.json({ success: false, message: "এই ইমেইল/ফোন দিয়ে আগেই একাউন্ট খোলা আছে!" });

        // OTP তৈরি (৪ ডিজিট)
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        
        console.log(`Reg OTP: ${otp}`);

        // 👇 এখানে otp পাঠানো হচ্ছে যাতে অ্যালার্টে দেখানো যায়
        res.json({ success: true, message: "OTP তৈরি হয়েছে!", serverOtp: otp }); 

    } catch (err) { res.status(500).json({ error: "সমস্যা হয়েছে" }); }
});

// --- ২. ফাইনাল রেজিস্ট্রেশন (OTP ভেরিফাই করে একাউন্ট খোলা) ---
app.post('/register-verify', async (req, res) => {
    try {
        const { username, password, birthday, identifier, type } = req.body;
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
            username: username,
            password: hashedPassword,
            birthday: new Date(birthday),
            email: type === 'email' ? identifier : "",
            mobile: type === 'mobile' ? identifier : ""
        });

        await newUser.save();
        res.json({ success: true, message: "একাউন্ট তৈরি সফল! এখন লগিন করুন।" });

    } catch (err) { 
        console.log(err);
        res.json({ success: false, message: "ইউজারনেমটি আগে থেকেই আছে বা অন্য সমস্যা।" }); 
    }
});

// --- ৩. লগিন রিকোয়েস্ট (পাসওয়ার্ড চেক + OTP পাঠানো) ---
app.post('/login-request', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // ইমেইল অথবা মোবাইল দিয়ে ইউজার খোঁজা
        const user = await User.findOne({ 
            $or: [{ email: identifier }, { mobile: identifier }, { username: identifier }] 
        });

        if (!user) return res.json({ success: false, message: "ইউজার পাওয়া যায়নি!" });

        // পাসওয়ার্ড চেক
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.json({ success: false, message: "ভুল পাসওয়ার্ড!" });

        // OTP তৈরি এবং সেভ করা
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        user.otp = otp;
        await user.save();

        console.log(`Login OTP: ${otp}`);

        // 👇 এখানেও otp পাঠানো হচ্ছে
        res.json({ success: true, message: "OTP তৈরি হয়েছে!", username: user.username, serverOtp: otp });

    } catch (err) { res.status(500).json({ error: "সার্ভারে সমস্যা!" }); }
});

// --- ৪. লগিন ভেরিফাই (OTP চেক করে টোকেন দেওয়া) ---
app.post('/login-verify', async (req, res) => {
    try {
        const { username, otp } = req.body;
        const user = await User.findOne({ username });

        if (!user || user.otp !== otp) {
            return res.json({ success: false, message: "ভুল OTP!" });
        }

        // সফল হলে OTP মুছে ফেলা
        user.otp = null;
        await user.save();

        const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY);

        res.json({
            success: true,
            token,
            username: user.username,
            profilePic: user.profilePic,
            coins: user.coins || 0,
            message: "লগিন সফল!"
        });

    } catch (err) { res.status(500).json({ error: "সমস্যা হয়েছে" }); }
});

// ৩. পোস্ট আপলোড
app.post('/upload', upload.single('mediaFile'), async (req, res) => {
    try {
        console.log("Upload Request Data:", req.body); 
        const { username, isShort, caption, location, privacy } = req.body;
        const isShortBoolean = isShort === 'true' || isShort === true || isShort === 'on';

        if (!req.file && !caption) {
            return res.status(400).json({ error: "ফাইল অথবা ক্যাপশন দিন।" });
        }

        const mediaUrl = req.file ? `/uploads/${req.file.filename}` : '';
        const fileType = req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : '';
        
        const newPost = new Post({
            username, mediaType: fileType, mediaUrl: mediaUrl, isShort: isShortBoolean,
            caption: caption || '', location: location || '', privacy: privacy || 'public'
        });

        await newPost.save();

        const notifMsg = isShortBoolean ? 'একটি রিলস' : 'একটি নতুন পোস্ট';
        if (typeof io !== 'undefined') {
            io.emit('new_notification', {
                sender: username, receiver: 'all', type: 'upload',
                message: `${username} ${notifMsg} আপলোড করেছেন।`, postId: newPost._id
            });
        }
        res.json({ success: true, message: "Upload Successful", post: newPost });
    } catch (err) { 
        console.log("Upload Error:", err);
        res.status(500).json({ error: "আপলোড সমস্যা" }); }
});

// ৪. কমেন্ট করা (আপডেট)
app.post('/comment/:id', async (req, res) => {
    try {
        const { user, text } = req.body;
        const post = await Post.findById(req.params.id);
        
        // নতুন কমেন্ট স্ট্রাকচার (লাইক ও রিপ্লাই এরিয়া সহ)
        post.comments.push({ user, text, likes: 0, replies: [] });
        await post.save();

        if (post.username !== user) {
            io.emit('new_notification', {
                sender: user, receiver: post.username, type: 'comment',
                message: `${user} কমেন্ট করেছেন: "${text}"`, postId: post._id
            });
            const newNotif = new Notification({
                sender: user, receiver: post.username, type: 'comment',
                message: `${user} কমেন্ট করেছেন: "${text}"`, postId: post._id
            });
            await newNotif.save();
        }
        res.json(post);
    } catch (err) { res.status(500).json({ error: "সমস্যা" }); }
});

// --- ৫. কমেন্টে লাইক দেওয়া (সংশোধিত) ---
app.post('/like-comment/:postId/:commentId', async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const post = await Post.findById(postId);
        
        const comment = post.comments.id(commentId);
        if(comment) {
            // লাইক বাড়ানো (যদি আগে না থাকে তবে ০ ধরে ১ বাড়াবে)
            comment.likes = (comment.likes || 0) + 1;
            
            await post.save();
            
            // 👇 এই লাইনটি গুরুত্বপূর্ণ: আমরা আপডেট হওয়া 'likes' সংখ্যাটি পাঠাচ্ছি
            res.json({ success: true, likes: comment.likes }); 
        } else {
            res.status(404).json({ error: "কমেন্ট পাওয়া যায়নি" });
        }
    } catch (err) { 
        res.status(500).json({ error: "সমস্যা হয়েছে" }); 
    }
});

// --- ৫. কমেন্টে রিপ্লাই দেওয়া (server.js) ---
app.post('/reply-comment/:postId/:commentId', async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const { user, text } = req.body;
        
        const post = await Post.findById(postId);
        const comment = post.comments.id(commentId);
        
        if (comment) {
            // রিপ্লাই অ্যারেতে যোগ করা
            if(!comment.replies) comment.replies = [];
            comment.replies.push({ user, text });
            
            await post.save();
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "কমেন্ট পাওয়া যায়নি" });
        }
    } catch (err) {
        res.status(500).json({ error: "সার্ভারে সমস্যা" });
    }
});
// ৭. কয়েন দেওয়া
app.post('/give-coin/:id', async (req, res) => {
    try {
        const { username } = req.body; // যে কয়েন দিচ্ছে (Giver)
        const post = await Post.findById(req.params.id);

        if (!post) return res.status(404).json({ error: "পোস্ট পাওয়া যায়নি" });
        // 👇 ফিক্স: যদি পুরনো পোস্টে coinedBy অ্যারে না থাকে, তবে খালি অ্যারে বানিয়ে নেওয়া
        if (!post.coinedBy) {
            post.coinedBy = [];
        }
        
        // 👇 ফিক্স: যদি পুরনো পোস্টে coins ফিল্ড না থাকে, ০ ধরা
        if (!post.coins) {
            post.coins = 0;
        }

        // ১. চেক করা: ইউজার কি আগেই এই পোস্টে কয়েন দিয়েছে?
        if (post.coinedBy.includes(username)) {
            return res.status(400).json({ error: "আপনি ইতিমধ্যে এই পোস্টে কয়েন দিয়েছেন!" });
        }

        // ২. পোস্টের মালিক (Creator) এবং দাতা (Giver) কে খুঁজে বের করা
        const creator = await User.findOne({ username: post.username });
        const giver = await User.findOne({ username: username });

        // ৩. ব্যালেন্স আপডেট করা
        
        // --> পোস্টের মালিক পাবে ৫ কয়েন
        if (creator) {
            creator.coins = (creator.coins || 0) + 5;
            await creator.save();
        }

        // --> যে ক্লিক করেছে (Giver) সে পাবে ১ কয়েন
        if (giver) {
            giver.coins = (giver.coins || 0) + 1;
            await giver.save();
        }

        // ৪. পোস্ট আপডেট করা
        post.coins = (post.coins || 0) + 1; // পোস্টের কয়েন সংখ্যা ১ বাড়ালাম
        post.coinedBy.push(username);       // দাতার নাম লিস্টে যোগ করলাম
        await post.save();

        // ৫. নোটিফিকেশন পাঠানো (মালিকের কাছে)
        if (post.username !== username) {
            const notifData = {
                sender: username,
                receiver: post.username,
                type: 'coin',
                message: `${username} আপনাকে কয়েন গিফট করেছেন! 🪙 (আপনি +5, তিনি +1)`,
                postId: post._id
            };
            
            if (typeof io !== 'undefined') {
                io.emit('new_notification', notifData);
            }
            
            const newNotif = new Notification(notifData);
            await newNotif.save();
        }

        res.json({ message: "সফল! আপনি ১ কয়েন পেয়েছেন এবং মালিক ৫ কয়েন পেয়েছে।" });

    } catch (err) {
        console.log("Coin Error:", err); // টার্মিনালে আসল এরর দেখাবে
        res.status(500).json({ error: "কয়েন লেনদেনে সমস্যা হয়েছে" });
    }
});
// ৮. অন্যান্য দরকারি রাউট
app.get('/posts', async (req, res) => {
    const posts = await Post.find().sort({ _id: -1 });
    res.json(posts);
});

app.get('/users', async (req, res) => {
    const users = await User.find({}, 'username profilePic following followers mobile');
    res.json(users);
});

// server.js এ /connect-user রাউট

app.post('/connect-user', async (req, res) => {
    try {
        const { sender, receiver } = req.body;
        if(sender === receiver) return res.json({ message: "নিজেকে ফলো করা যায় না!" });

        const me = await User.findOne({ username: sender });
        const targetUser = await User.findOne({ username: receiver });

        if (!me || !targetUser) return res.status(404).json({ message: "ইউজার নেই" });
        
        // ফলো করা
        if (!me.following.includes(receiver)) {
            me.following.push(receiver);
            targetUser.followers.push(sender);
            
            // 👇 ৫ কয়েন যোগ করা
            me.coins = (me.coins || 0) + 5;

            await me.save();
            await targetUser.save();

            io.emit('new_notification', {
                sender: sender, receiver: receiver, type: 'message', 
                message: `${sender} আপনাকে ফলো করেছেন!`, postId: null
            });
            
            res.json({ success: true, newCoins: me.coins });
        } else {
            res.json({ message: "অলরেডি ফলো করছেন" });
        }
    } catch (err) { res.status(500).json({ error: "সমস্যা" }); }
});

app.post('/unconnect-user', async (req, res) => {
    try {
        const { sender, targetUser } = req.body;

        const me = await User.findOne({ username: sender });
        const target = await User.findOne({ username: targetUser });

        if (!me || !target) return res.status(404).json({ error: "ইউজার নেই" });

        // আনফলো করা
        me.following = me.following.filter(u => u !== targetUser);
        target.followers = target.followers.filter(u => u !== sender);

        // 👇 ৫ কয়েন কেটে নেওয়া (যদি ০ এর বেশি থাকে)
        if (me.coins >= 5) {
            me.coins = me.coins - 5;
        } else {
            me.coins = 0; // মাইনাস না হওয়ার জন্য
        }

        await me.save();
        await target.save();

        res.json({ success: true, message: "আনফলো করা হয়েছে (-5 কয়েন)", newCoins: me.coins });

    } catch (err) {
        res.status(500).json({ error: "সমস্যা হয়েছে" });
    }
});

app.post('/connect-by-phone', async (req, res) => {
    try {
        const { sender, mobile } = req.body;
        const targetUser = await User.findOne({ mobile: mobile });
        const me = await User.findOne({ username: sender });

        if (!targetUser) return res.json({ success: false, message: "এই নম্বরে কোনো একাউন্ট নেই!" });
        if (targetUser.username === sender) return res.json({ success: false, message: "এটা আপনার নিজের নম্বর!" });

        if (!me.following) me.following = [];
        if (!targetUser.followers) targetUser.followers = [];

        if (!me.following.includes(targetUser.username)) {
            me.following.push(targetUser.username);
            targetUser.followers.push(sender);
            await me.save();
            await targetUser.save();
            io.emit('new_notification', {
                sender: sender, receiver: targetUser.username, type: 'message',
                message: `${sender} আপনার নম্বরের মাধ্যমে আপনাকে খুঁজে কানেক্ট করেছেন।`, postId: null
            });
            return res.json({ success: true, message: `সফল! ${targetUser.username}-এর সাথে কানেক্ট করা হয়েছে।` });
        } else {
            return res.json({ success: false, message: "ইতোমধ্যে কানেক্টেড আছেন।" });
        }
    } catch (err) { res.status(500).json({ error: "সার্ভার সমস্যা" }); }
});

// --- server.js এর প্রোফাইল আপডেট রাউট ---
app.post('/update-profile-data', upload.fields([{ name: 'profilePic' }, { name: 'coverPic' }]), async (req, res) => {
    try {
        const { username, bio } = req.body;
        
        // আপডেটের জন্য অবজেক্ট তৈরি
        let updateData = {};
        
        // বায়ো আপডেট (যদি ইউজার কিছু লিখে থাকে)
        if (bio) updateData.bio = bio;

        // প্রোফাইল পিকচার আপডেট
        if (req.files['profilePic']) {
            updateData.profilePic = `/uploads/${req.files['profilePic'][0].filename}`;
        }

        // কভার ফটো আপডেট
        if (req.files['coverPic']) {
            updateData.coverPic = `/uploads/${req.files['coverPic'][0].filename}`;
        }

        // ডাটাবেসে সেভ করা
        const user = await User.findOneAndUpdate(
            { username: username }, 
            { $set: updateData }, 
            { new: true } // আপডেটেড ডাটা ফেরত দেবে
        );
        
        res.json({ 
            success: true, 
            message: "প্রোফাইল আপডেট হয়েছে!", 
            profilePic: user.profilePic,
            coverPic: user.coverPic,
            bio: user.bio
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে" });
    }
});
app.get('/my-balance/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    res.json({ coins: user ? user.coins : 0 });
});

app.delete('/delete-post/:id', async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        res.json({ message: "ডিলিট সফল" });
    } catch (err) { res.status(500).json({ error: "সমস্যা" }); }
});

app.get('/messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    const messages = await Message.find({
        $or: [ { sender: user1, receiver: user2 }, { sender: user2, receiver: user1 } ]
    }).sort({ createdAt: 1 }); 
    res.json(messages);
});

// গ্লোবাল সার্চ API
app.get('/global-search/:query', async (req, res) => {
    try {
        const query = req.params.query;
        const searchRegex = new RegExp(query, 'i');
        const users = await User.find({ username: searchRegex }).select('username profilePic');
        const posts = await Post.find({ caption: searchRegex }).sort({ _id: -1 });
        res.json({ users, posts });
    } catch (err) { res.status(500).json({ error: "সার্চ এরর" }); }
});

// --- পাসওয়ার্ড পরিবর্তন রাউট ---
app.post('/change-password', async (req, res) => {
    try {
        const { username, oldPass, newPass } = req.body;
        const user = await User.findOne({ username });

        // পুরনো পাসওয়ার্ড চেক
        const isMatch = await bcrypt.compare(oldPass, user.password);
        if (!isMatch) return res.json({ success: false, message: "পুরনো পাসওয়ার্ড ভুল!" });

        // নতুন পাসওয়ার্ড হ্যাশ করা
        const hashedPass = await bcrypt.hash(newPass, 10);
        user.password = hashedPass;
        await user.save();

        res.json({ success: true, message: "পাসওয়ার্ড পরিবর্তন হয়েছে!" });
    } catch (err) { res.status(500).json({ error: "সমস্যা হয়েছে" }); }
});

// --- একাউন্ট ডিলিট রাউট ---
app.post('/delete-my-account', async (req, res) => {
    try {
        const { username } = req.body;
        
        // ১. ইউজার ডিলিট
        await User.findOneAndDelete({ username });
        // ২. ইউজারের সব পোস্ট ডিলিট
        await Post.deleteMany({ username });
        // ৩. নোটিফিকেশন ডিলিট
        await Notification.deleteMany({ $or: [{ sender: username }, { receiver: username }] });

        res.json({ success: true, message: "একাউন্ট সফলভাবে ডিলিট হয়েছে!" });
    } catch (err) { res.status(500).json({ error: "সমস্যা হয়েছে" }); }
});

// --- ১৩. শর্টস দেখার জন্য কয়েন রিওয়ার্ড (Watch to Earn) ---
app.post('/watch-short/:id', async (req, res) => {
    try {
        const { username } = req.body; // যে দেখছে (Viewer)
        const post = await Post.findById(req.params.id);

        if (!post) return res.status(404).json({ error: "পোস্ট নেই" });

        // ১. চেক করা: ইউজার কি আগেই এই ভিডিও দেখেছে?
        if (!post.watchedBy) post.watchedBy = []; // সেফটি
        
        if (post.watchedBy.includes(username)) {
            return res.json({ success: false, message: "আগেই দেখা হয়েছে" });
        }

        // ২. ইউজারদের খোঁজা
        const creator = await User.findOne({ username: post.username });
        const viewer = await User.findOne({ username: username });

        // ৩. ব্যালেন্স আপডেট
        // -> দর্শক পাবে ১ কয়েন
        if (viewer) {
            viewer.coins = (viewer.coins || 0) + 1;
            await viewer.save();
        }

        // -> মালিক পাবে ৫ কয়েন (যদি নিজের ভিডিও না হয়)
        if (creator && post.username !== username) {
            creator.coins = (creator.coins || 0) + 5;
            await creator.save();
        }

        // ৪. ভিডিও আপডেট (watchedBy লিস্টে নাম যোগ করা)
        post.watchedBy.push(username);
        await post.save();

        res.json({ success: true, message: "১ কয়েন আর্ন হয়েছে!" });

    } catch (err) {
        res.status(500).json({ error: "সমস্যা হয়েছে" });
    }
});

// --- ১৩. ভিডিও দেখার রিওয়ার্ড (Shorts + Long Video) ---
app.post('/watch-video/:id', async (req, res) => {
    try {
        const { username } = req.body; 
        const post = await Post.findById(req.params.id);

        if (!post) return res.status(404).json({ error: "পোস্ট নেই" });

        // ১. চেক করা: আগেই দেখা হয়েছে কিনা
        if (!post.watchedBy) post.watchedBy = [];
        
        if (post.watchedBy.includes(username)) {
            return res.json({ success: false, message: "আগেই দেখা হয়েছে" });
        }

        // ২. ইউজারদের খোঁজা
        const creator = await User.findOne({ username: post.username });
        const viewer = await User.findOne({ username: username });

        // ৩. ব্যালেন্স আপডেট
        if (viewer) {
            viewer.coins = (viewer.coins || 0) + 1; // দর্শক +১
            await viewer.save();
        }

        if (creator && post.username !== username) {
            creator.coins = (creator.coins || 0) + 5; // মালিক +৫
            await creator.save();
        }

        // ৪. ভিডিও আপডেট
        post.watchedBy.push(username);
        await post.save();

        res.json({ success: true, message: "ভিডিও দেখার জন্য ১ কয়েন পেয়েছেন!" });

    } catch (err) {
        res.status(500).json({ error: "সমস্যা হয়েছে" });
    }
});

// --- রিপোর্ট করার রাউট ---
app.post('/report', async (req, res) => {
    try {
        const { reporter, reportedId, reason, type } = req.body;
        const newReport = new Report({ reporter, reportedId, reason, type });
        await newReport.save();
        res.json({ success: true, message: "রিপোর্ট জমা হয়েছে! আমরা এটি রিভিউ করব।" });
    } catch (err) {
        res.status(500).json({ error: "সমস্যা হয়েছে" });
    }
});

// --- ব্লক করার রাউট ---
app.post('/block-user', async (req, res) => {
    try {
        const { username, blockedUser } = req.body;
        const user = await User.findOne({ username });

        if (!user.blockedUsers) user.blockedUsers = [];
        
        if (!user.blockedUsers.includes(blockedUser)) {
            user.blockedUsers.push(blockedUser);
            
            // ব্লক করলে আনফলোও করে দেওয়া ভালো
            user.following = user.following.filter(u => u !== blockedUser);
            
            await user.save();
            res.json({ success: true, message: `${blockedUser}-কে ব্লক করা হয়েছে।` });
        } else {
            res.json({ success: false, message: "ইতিমধ্যে ব্লক করা আছে।" });
        }
    } catch (err) {
        res.status(500).json({ error: "সমস্যা হয়েছে" });
    }
});

// --- Privacy Policy Route (গুগল প্লে স্টোরের জন্য) ---
app.get('/privacy-policy', (req, res) => {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Privacy Policy - Fun-Earn</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background: #f4f4f9; color: #333; }
            .container { max-width: 800px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #1877f2; }
            h2 { color: #444; margin-top: 20px; }
            p { margin-bottom: 15px; }
            ul { margin-bottom: 15px; }
            li { margin-bottom: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Privacy Policy for Fun-Earn</h1>
            <p><strong>Effective Date:</strong> 2025-01-01</p>
            
            <p>Welcome to Fun-Earn. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our app.</p>

            <h2>1. Information We Collect</h2>
            <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows:</p>
            <ul>
                <li><strong>Identity Data:</strong> Username, Profile Picture.</li>
                <li><strong>Contact Data:</strong> Email address or Phone number (for login/verification).</li>
                <li><strong>Media Data:</strong> Photos and Videos you upload.</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <ul>
                <li>To register you as a new customer.</li>
                <li>To manage our relationship with you.</li>
                <li>To enable you to partake in a prize draw, competition or complete a survey.</li>
            </ul>

            <h2>3. Permissions We Request</h2>
            <p>To provide specific features, we may request the following permissions:</p>
            <ul>
                <li><strong>Camera:</strong> To take photos/videos for uploading posts or live streaming.</li>
                <li><strong>Location:</strong> To add location tags to your posts (Optional).</li>
                <li><strong>Storage:</strong> To upload photos/videos from your gallery.</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way.</p>

            <h2>5. Contact Us</h2>
            <p>If you have any questions about this privacy policy, please contact us at: <strong>support@funearn.com</strong></p>
            
            <hr>
            <p style="text-align:center; font-size:12px; color:gray;">&copy; 2025 Fun-Earn App. All rights reserved.</p>
        </div>
    </body>
    </html>
    `;
    res.send(htmlContent);
});

// সার্ভার চালু
// --- ২. ফাইলের একদম শেষে (Server Listen আপডেট) ---

// পোর্ট সেটআপ (Render বা Heroku নিজের পোর্ট বসাবে)
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});