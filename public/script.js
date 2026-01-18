// ==========================================
// ১. ভেরিয়েবল এবং ইনিশিয়ালাইজেশন (ফিক্সড)
// ==========================================
const socket = io();
let currentUser = null;
let token = localStorage.getItem('token');
let currentChatFriend = null;
let myPeer = null; // পিয়ার কানেকশন
// পেজ পুরোপুরি লোড হওয়ার পর কোড রান করবে
document.addEventListener('DOMContentLoaded', () => {
    
    // টোকেন চেক
    if (token) {
        currentUser = localStorage.getItem('username');
        showApp(); // লগিন থাকলে অ্যাপ দেখাবে
    } else {
        // লগিন না থাকলে লগিন পেজ দেখাবে
        const authSection = document.getElementById('auth-section');
        const appSection = document.getElementById('app-section');
        
        if (authSection) authSection.style.display = 'flex';
        if (appSection) appSection.style.display = 'none';

        document.getElementById('top-navbar').style.display = 'none';
        document.getElementById('bottom-navbar').style.display = 'none';
    }

});

// ==========================================
// ২. মেইন অ্যাপ কন্ট্রোল (Null Error ফিক্সড)
// ==========================================

// --- অ্যাপ ওপেন করার মেইন ফাংশন (PeerJS সহ) ---
function showApp() {
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');

    if (authSection) authSection.style.display = 'none';
    if (appSection) appSection.style.display = 'block';
    
    // Navbar দেখানো
    document.getElementById('top-navbar').style.display = 'flex';
    document.getElementById('bottom-navbar').style.display = 'flex';

    // ১. ছবি এবং নাম সেট করা
    const storedPic = localStorage.getItem('profilePic');
    const defaultPic = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    const finalPic = (storedPic && storedPic !== "undefined") ? storedPic : defaultPic;

    const imagesToUpdate = ['bottom-profile-img', 'menu-user-img', 'dashboard-pic', 'modal-user-pic', 'nav-profile-img'];
    imagesToUpdate.forEach(id => {
        const img = document.getElementById(id);
        if (img) {
            img.src = finalPic;
            img.onerror = function() { 
                this.src = defaultPic; 
                this.onerror = null;
            };
        }
    });

    const menuName = document.getElementById('menu-user-name');
    if(menuName) menuName.innerText = currentUser;
    const modalName = document.getElementById('modal-user-name');
    if(modalName) modalName.innerText = currentUser;

    // ২. ডাটা লোড
    if (typeof loadPosts === 'function') loadPosts();
    if (typeof updateNavBalance === 'function') updateNavBalance();

    // ৩. 👇 PeerJS (ভিডিও কল) সেটআপ (নতুন যোগ করা হয়েছে)
    if (typeof Peer !== 'undefined') {
        // আগের কোনো কানেকশন থাকলে বন্ধ করা (যাতে ডুপ্লিকেট না হয়)
        if (window.myPeer) window.myPeer.destroy();

        window.myPeer = new Peer(currentUser); // ইউজারের নাম দিয়েই আইডি হবে

        window.myPeer.on('open', (id) => {
            console.log("My Peer ID is:", id);
        });

        // কেউ কল করলে রিসিভ করার লজিক
        window.myPeer.on('call', (call) => {
            console.log("Incoming call from:", call.peer);
            
            const callerId = call.peer;
            const modal = document.getElementById('incoming-call-modal');
            
            document.getElementById('caller-name').innerText = callerId;
            document.getElementById('call-type-text').innerText = "Incoming Video Call...";
            
            // রিংটোন বাজানো
            if(typeof callRingtone !== 'undefined') {
                callRingtone.currentTime = 0;
                callRingtone.play().catch(e=>{});
            }

            modal.style.display = 'flex';
            window.incomingCaller = callerId;
            window.currentCall = call; // কল অবজেক্ট সেভ রাখা
        });

        window.myPeer.on('error', (err) => {
            console.log("PeerJS Error:", err);
            if(err.type === 'unavailable-id') {
                // যদি আইডি আগে থেকেই থাকে, রিকানেক্ট করার চেষ্টা বা ইগনোর
                console.log("ID already taken, maybe tab refresh");
            }
        });
    } else {
        console.log("PeerJS library not loaded!");
    }
}

// ================= অথেনটিকেশন (সরাসরি - OTP ছাড়া) =================

// ১. ইনপুট ফিল্ড বদলানো (ইমেইল/ফোন)
function toggleRegInput(type) {
    const input = document.getElementById('regIdentifier');
    if (type === 'email') {
        input.placeholder = "আপনার ইমেইল দিন";
        input.type = "email";
    } else {
        input.placeholder = "আপনার মোবাইল নম্বর দিন";
        input.type = "number";
    }
}

// ২. লগিন ও রেজিস্টার ফর্ম অদল-বদল
function toggleAuth() {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    
    // OTP সেকশন থাকলে লুকিয়ে ফেলা
    const otpSection = document.getElementById('otp-section');
    if(otpSection) otpSection.style.display = 'none';

    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
    }
}

// ৩. লগআউট ফাংশন
function logout() {
    localStorage.clear();
    location.reload();
}

// ৪. সরাসরি রেজিস্ট্রেশন ফাংশন
async function register() {
    const username = document.getElementById('regUser').value;
    const identifier = document.getElementById('regIdentifier').value; // ইমেইল বা ফোন
    const password = document.getElementById('regPass').value;
    const birthday = document.getElementById('regBirthday').value;
    
    // রেডিও বাটন চেক (Email না Mobile)
    const typeElem = document.querySelector('input[name="regType"]:checked');
    const type = typeElem ? typeElem.value : 'email';

    if (!username || !identifier || !password || !birthday) {
        return alert("সব তথ্য পূরণ করুন!");
    }

    try {
        // বাটন লোডিং ইফেক্ট
        const btn = document.querySelector('#register-form .btn-success');
        const oldText = btn.innerText;
        btn.innerText = "অপেক্ষা করুন...";
        btn.disabled = true;

        const res = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, identifier, type, birthday })
        });
        const data = await res.json();

        if (data.success) {
            alert(data.message);
            toggleAuth(); // সফল হলে লগিন পেজে নিয়ে যাবে
        } else {
            alert(data.message || data.error);
        }
        
        btn.innerText = oldText;
        btn.disabled = false;

    } catch (err) {
        console.log(err);
        alert("সার্ভার এরর");
    }
}

// ৫. সরাসরি লগিন ফাংশন
async function login() {
    const identifier = document.getElementById('loginId').value;
    const password = document.getElementById('loginPass').value;

    if (!identifier || !password) return alert("আইডি এবং পাসওয়ার্ড দিন!");

    try {
        // বাটন লোডিং ইফেক্ট
        const btn = document.querySelector('#login-form .btn-primary');
        const oldText = btn.innerText;
        btn.innerText = "লগিন হচ্ছে...";
        btn.disabled = true;

        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();

       if (data.token) {
            // ১. টোকেন ও নাম সেভ
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            
            // ২. ছবি সেভ (যদি না থাকে তবে ডিফল্ট)
            const pic = data.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
            localStorage.setItem('profilePic', pic);

            currentUser = data.username;
            showApp();
        } else {
            alert(data.message || data.error);
            btn.innerText = oldText;
            btn.disabled = false;
        }
    } catch (err) {
        console.log(err);
        alert("লগিন সমস্যা");
    }
}


// নিচের বারের ট্যাব কালার হ্যান্ডেলিং
function setActiveBottomTab(index) {
    document.querySelectorAll('.b-nav-item').forEach(el => {
        el.classList.remove('active-tab');
        if(!el.classList.contains('home-bubble')) el.style.color = '#65676b';
    });
    
    const items = document.querySelectorAll('.b-nav-item');
    if (items[index]) {
        items[index].classList.add('active-tab');
        if(!items[index].classList.contains('home-bubble')) items[index].style.color = '#1877f2';
    }
}

// ==========================================
// ৪. ফিড এবং পোস্ট ডিসপ্লে
// ==========================================

// --- হোম পেজ (স্বাভাবিক পোস্ট) ---
async function loadPosts() {
    const topBar = document.getElementById('top-shorts-bar');
    if (topBar) topBar.style.display = 'flex';
    
    // 👇 শর্টস লোড করা (যদি ফাংশনটি থাকে)
    if(typeof loadTopShorts === 'function') loadTopShorts();
    setActiveBottomTab(2); // Home index
    
    const feed = document.getElementById('feed');
    feed.innerHTML = '<div style="text-align:center; padding:20px;">পোস্ট লোড হচ্ছে...</div>';

    try {
        const [postRes, userRes] = await Promise.all([ fetch('/posts'), fetch('/users') ]);
        const posts = await postRes.json();
        const allUsers = await userRes.json();
        
        // আমার ফলোয়িং লিস্ট (ফলো বাটন চেক করার জন্য)
        const me = allUsers.find(u => u.username === currentUser);
        const myFollowing = me ? (me.following || []) : [];
        const blockedList = me.blockedUsers || []; // ব্লক করা তালিকা

        feed.innerHTML = ''; 

        // শুধু সাধারণ পোস্ট ফিল্টার (Shorts বাদে)
        const normalPosts = posts.filter(p => p.isShort !== true && !blockedList.includes(p.username));

        if (normalPosts.length === 0) {
            feed.innerHTML = '<div class="card" style="padding:20px; text-align:center;">কোনো পোস্ট নেই।</div>';
            return;
        }

        normalPosts.forEach(post => {
            const isFollowing = myFollowing.includes(post.username);
            const author = allUsers.find(u => u.username === post.username);
            const authorPic = author ? author.profilePic : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
            createPostElement(post, feed, isFollowing, authorPic);
        });

    } catch (err) {
        console.log(err);
        feed.innerHTML = '<p style="color:red; text-align:center;">সার্ভার সমস্যা!</p>';
    }
    loadTopShorts(); 
}

// --- ভিডিও ফিল্টার ফাংশন (Follow Status Fix) ---
async function filterVideos() {
    // ১. ট্যাব স্টাইল ঠিক করা
    document.querySelectorAll('.b-nav-item').forEach(el => el.classList.remove('active-tab'));
    const navItems = document.querySelectorAll('.b-nav-item');
    if(navItems[1]) navItems[1].classList.add('active-tab'); // Video index 1

    const feed = document.getElementById('feed');
    feed.innerHTML = '<div style="text-align:center; padding:20px;">ভিডিও লোড হচ্ছে...</div>';

    // ২. টপ শর্টস বার লুকানো
    const topBar = document.getElementById('top-shorts-bar');
    if (topBar) topBar.style.display = 'none';

    try {
        // ৩. পোস্ট এবং ইউজার ডাটা আনা (Follow চেক করার জন্য)
        const [postRes, userRes] = await Promise.all([
            fetch('/posts'),
            fetch('/users')
        ]);

        const posts = await postRes.json();
        const allUsers = await userRes.json();
        
        // ৪. আমার ফলোয়িং লিস্ট বের করা
        const me = allUsers.find(u => u.username === currentUser);
        const myFollowing = me ? (me.following || []) : [];

        feed.innerHTML = '';

        // ৫. শুধু ভিডিও পোস্ট ফিল্টার করা
        const videoPosts = posts.filter(p => p.mediaType === 'video' && p.isShort !== true);

        if (videoPosts.length === 0) {
            feed.innerHTML = '<div class="card" style="padding:30px; text-align:center;">কোনো ভিডিও নেই।</div>';
            return;
        }

        // ৬. ভিডিও দেখানো
        videoPosts.forEach(post => {
            // চেক করা আমি ফলো করছি কিনা
            const isFollowing = myFollowing.includes(post.username);
            const author = allUsers.find(u => u.username === post.username);
            const authorPic = author ? author.profilePic : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
            // পোস্ট তৈরি করা (সঠিক ফলো স্ট্যাটাস সহ)
            createPostElement(post, feed, isFollowing, authorPic);
        });

    } catch(err) {
        console.log(err);
        feed.innerHTML = '<p style="color:red; text-align:center;">সমস্যা হয়েছে!</p>';
    }
}

// --- পোস্ট তৈরি করার মেইন ফাংশন (সব ফিচার + ফিক্সড) ---
function createPostElement(post, feed, isFollowing, authorPic) {
    // ১. প্রাইভেসি চেক (Only Me হলে এবং আমি মালিক না হলে দেখাবে না)
    if (post.privacy === 'private' && post.username !== currentUser) return;

    // ২. মিডিয়া টাইপ (ভিডিও নাকি ছবি)
    let mediaContent = '';
    if (post.mediaType === 'video') {
        mediaContent = `<video controls src="${post.mediaUrl}" 
                          onplay="claimWatchReward('${post._id}')" 
                          style="width:100%; margin-top:10px; border-radius:8px; background:black; max-height:500px;">
                        </video>`;
    } else if (post.mediaUrl) {
         mediaContent = `<img src="${post.mediaUrl}" 
          onerror="this.onerror=null; this.src='https://via.placeholder.com/500x300?text=Image+Deleted';" 
          style="width:100%; margin-top:10px; object-fit:cover; border-radius:8px;">`;
    }

    // ৩. ক্যাপশন, লোকেশন এবং প্রাইভেসি লজিক
    let captionHTML = (post.caption && post.caption !== 'undefined') 
        ? `<p style="font-size:15px; margin:8px 0; color:#050505; white-space: pre-wrap;">${post.caption}</p>` 
        : '';

    let locationHTML = (post.location && post.location !== 'undefined') 
        ? ` is at <b style="color:#1877f2;">${post.location}</b>` 
        : '';

    let privacyIcon = '<i class="fas fa-globe-americas" title="Public"></i>';
    if (post.privacy === 'private') {
        privacyIcon = '<i class="fas fa-lock" title="Only Me"></i>';
    }

    // ৪. ইউজার ছবি (ডিফল্ট)
    const finalUserPic = authorPic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

    // ৫. ফলো বাটন লজিক
    let followBtnHtml = '';
    if (post.username !== currentUser) {
        if (isFollowing) {
            followBtnHtml = `<span class="following-text follow-btn-${post.username}" style="color:gray; font-size:12px; margin-left:10px; cursor:pointer;" onclick="toggleConnection('${post.username}', 'unconnect')">Following</span>`;
        } else {
            followBtnHtml = `<button class="follow-btn-small follow-btn-${post.username}" onclick="toggleConnection('${post.username}', 'connect')" 
                style="margin-left:10px; color:#1877f2; border:1px solid #1877f2; background:white; font-weight:bold; cursor:pointer; padding: 2px 8px; border-radius: 12px; font-size: 11px;">
                Follow <span style="color:#f57f17;">+5🪙</span>
            </button>`;
        }
    }

    // ৬. কয়েন বাটন লজিক
    const coinedBy = post.coinedBy || [];
    const hasCoined = coinedBy.includes(currentUser);
    const coinColor = hasCoined ? '#fbc02d' : 'gray';
    const coinAction = hasCoined ? '' : `giveCoin('${post._id}')`;
    let coinText = '';
    if (!hasCoined) {
        coinText = ` <span id="coin-txt-${post._id}" style="font-size:10px; background:#e7f3ff; color:#1877f2; padding:2px 6px; border-radius:10px; margin-left:5px;">Get 1🪙</span>`;
    }

    // ৭. মেনু অপশন লজিক (Report/Block/Delete)
    let menuOptions = '';
    if (post.username === currentUser) {
        menuOptions = `<div class="menu-option text-danger" onclick="deletePost('${post._id}')" style="padding:10px; cursor:pointer; font-size:14px; color:red;"><i class="fas fa-trash"></i> Delete Post</div>`;
    } else {
        menuOptions = `
            <div class="menu-option" onclick="reportContent('${post._id}', 'post')" style="padding:10px; cursor:pointer; color:orange; font-size:14px;"><i class="fas fa-flag"></i> Report</div>
            <div class="menu-option" onclick="blockUser('${post.username}')" style="padding:10px; cursor:pointer; color:red; font-size:14px;"><i class="fas fa-ban"></i> Block User</div>`;
    }

    // ৮. কমেন্ট সংখ্যা
    const commentCount = post.comments ? post.comments.length : 0;

    const timeString = timeAgo(post.createdAt);

    // ৯. HTML তৈরি
    const postDiv = document.createElement('div');
    postDiv.className = 'card post'; 
    
    postDiv.innerHTML = `
        <div class="post-header" style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
            
            <!-- 👇 onerror যুক্ত করা হয়েছে (ছবি ভাঙলে ডিফল্ট দেখাবে) -->
            <img src="${finalUserPic}" 
                 class="post-avatar" 
                 onclick="viewUserProfile('${post.username}')" 
                 onerror="this.src='https://cdn-icons-png.flaticon.com/512/3135/3135715.png'"
                 style="width:40px; height:40px; border-radius:50%; cursor:pointer; object-fit:cover; border:1px solid #ddd;">
            
            <div style="flex:1;">
                <div style="display:flex; align-items:center;">
                    <h4 style="margin:0; cursor:pointer;" onclick="viewUserProfile('${post.username}')">
                        ${post.username} ${locationHTML}
                    </h4>
                    ${followBtnHtml}
                </div>
                <span style="font-size:12px; color:gray;">
                    ${timeString} · ${privacyIcon}
                </span>
            </div>
            
            <!-- মেনু বাটন -->
            <div class="post-menu-container" style="position:relative;">
                <button class="three-dots-btn" onclick="togglePostMenu('${post._id}')" style="background:none; border:none; font-size:20px; cursor:pointer;">⋮</button>
                <div id="menu-${post._id}" class="post-dropdown-menu" style="display:none; position:absolute; right:0; top:30px; background:white; box-shadow:0 2px 10px rgba(0,0,0,0.2); width:150px; border-radius:5px; z-index:10;">
                    <div class="menu-option" onclick="downloadMedia('${post.mediaUrl}', '${post.mediaType}')" style="padding:10px; cursor:pointer; font-size:14px;">
                        <i class="fas fa-download"></i> Download
                    </div>
                    ${menuOptions}
                </div>
            </div>
        </div>

        <!-- বডি -->
        <div style="padding:0 5px;">
            ${captionHTML}
            ${mediaContent}
        </div>

        <!-- অ্যাকশন বাটনস -->
        <div class="actions" style="padding:10px; border-top:1px solid #eee; display:flex; margin-top:10px; justify-content:space-between;">
            
            <!-- কয়েন -->
            <button id="coin-btn-${post._id}" onclick="${coinAction}" style="flex:1; background:none; border:none; color:${coinColor}; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                <i class="fas fa-coins"></i>&nbsp; <span id="coin-val-${post._id}">${post.coins || 0}</span> ${coinText}
            </button>
            
            <!-- কমেন্ট (মোডাল ওপেন হবে) -->
            <button onclick="openPostComments('${post._id}')" style="flex:1; background:none; border:none; font-weight:bold; color:gray; cursor:pointer;">
                <i class="far fa-comment-alt"></i> Comment (${commentCount})
            </button>
            
            <!-- শেয়ার -->
            <button onclick="sharePost('${post.mediaUrl}')" style="flex:1; background:none; border:none; font-weight:bold; color:gray; cursor:pointer;">
                <i class="fas fa-share"></i> Share
            </button>
        </div>
        
        <!-- কমেন্ট বক্স (ইনলাইন নেই, মোডাল আসবে) -->
    `;
    
    feed.appendChild(postDiv);
}

// --- script.js এর renderSingleComment ফাংশন (আপডেট করা) ---
function renderSingleComment(postId, c) {
    // ১. রিপ্লাইগুলো দেখানোর জন্য একটি কন্টেইনার আইডি তৈরি
    let repliesHTML = `<div id="replies-holder-${c._id}">`; 
    
    if(c.replies && c.replies.length > 0) {
        c.replies.forEach(r => {
            // রিপ্লাই ইউজারের ছবি (ডিফল্ট)
            // রিয়েল ছবি আনতে গেলে backend populate দরকার, আপাতত ডিফল্ট বা API ফেচ ছাড়া কঠিন
            const replyPic = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"; 
            
            repliesHTML += `
                <div style="margin-top:5px; margin-left:30px; font-size:13px; display:flex; gap:5px;">
                    <img src="${replyPic}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                    <div style="background:#e4e6eb; padding:5px 10px; border-radius:10px;">
                        <b>${r.user}</b> ${r.text}
                    </div>
                </div>`;
        });
    }
    repliesHTML += `</div>`; // কন্টেইনার শেষ

    // ২. মেইন কমেন্ট HTML
    // 👇 Love বাটনে id="like-count-${c._id}" যোগ করা হয়েছে
    return `
    <div class="comment-wrapper" style="margin-bottom:10px;">
        <div style="display:flex; gap:8px;">
            <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" class="comment-avatar" onclick="viewUserProfile('${c.user}')" style="width:32px; height:32px; border-radius:50%; border:1px solid #ddd;">
            
            <div>
                <div class="comment-bubble" style="background:#f0f2f5; padding:8px 12px; border-radius:18px; display:inline-block;">
                    <b onclick="viewUserProfile('${c.user}')" style="cursor:pointer;">${c.user}</b> 
                    <span style="margin-left:5px;">${c.text}</span>
                </div>
                
                <div style="font-size:12px; color:gray; margin-left:10px; margin-top:2px; display:flex; gap:10px;">
                    <span id="like-span-${c._id}" style="cursor:pointer; font-weight:bold;" onclick="likeComment('${postId}', '${c._id}')">
                        Love (${c.likes || 0})
                    </span>
                    <span style="cursor:pointer; font-weight:bold;" onclick="toggleReplyBox('${c._id}')">Reply</span>
                    <span>Just now</span>
                </div>
            </div>
        </div>

        <!-- রিপ্লাই সেকশন -->
        ${repliesHTML}

        <!-- রিপ্লাই ইনপুট বক্স -->
        <div id="reply-box-${c._id}" style="display:none; margin-top:5px; margin-left:40px;">
            <div style="display:flex; gap:5px;">
                <input type="text" id="reply-input-${c._id}" placeholder="Reply to ${c.user}..." style="padding:5px; border-radius:15px; border:1px solid #ccc; font-size:12px; flex:1;">
                <button onclick="submitReply('${postId}', '${c._id}')" style="font-size:11px; background:#1877f2; color:white; border:none; border-radius:10px; padding:0 10px; cursor:pointer;">Send</button>
            </div>
        </div>
    </div>`;
}

async function likePost(id) {
    // এখন বডিতে username পাঠাচ্ছি
    await fetch(`/like/${id}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser }) 
    });
    loadPosts();
}

// --- script.js এর addComment ফাংশন ---
async function addComment(id) {
    const input = document.getElementById(`comment-${id}`);
    const text = input.value;
    if(!text) return;

    try {
        const res = await fetch(`/comment/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser, text: text })
        });
        
        const updatedPost = await res.json(); // সার্ভার থেকে আপডেটেড পোস্ট আসবে

        // 👇 পেজ রিলোড না করে কমেন্ট যোগ করা
        const commentsList = document.getElementById(`comments-list-${id}`);
        if(commentsList) {
            // নতুন কমেন্টটি সবার শেষে আছে
            const newComment = updatedPost.comments[updatedPost.comments.length - 1];
            // HTML বানিয়ে লিস্টে যোগ করা
            const newCommentHTML = renderSingleComment(id, newComment);
            commentsList.insertAdjacentHTML('beforeend', newCommentHTML);
        }

        // ইনপুট খালি করা
        input.value = '';

    } catch(err) {
        console.log(err);
    }
}
async function sharePost(mediaUrl) {
    const fullUrl = window.location.origin + mediaUrl;
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Social App Post',
                text: 'Check this out!',
                url: fullUrl
            });
        } catch (error) { console.log(error); }
    } else {
        navigator.clipboard.writeText(fullUrl);
        alert('লিংক কপি করা হয়েছে!');
    }
}

// ==========================================
// 🔔 নোটিফিকেশন লিসেনার (Socket.io) - ফাইনাল ভার্সন
// ==========================================

// আগের কোনো লিসেনার থাকলে বন্ধ করা (ডুপ্লিকেট ফিক্স)
socket.off('new_notification');

socket.on('new_notification', (data) => {
    // ১. চেক করা: নোটিফিকেশনটি কি আমার জন্য?
    if (data.receiver === currentUser || data.receiver === 'all') {
        
        // নিজের অ্যাকশনের নোটিফিকেশন দরকার নেই
        if (data.sender === currentUser) return;

        console.log("New Notification:", data.message);

        // ২. সাউন্ড বাজানো (যদি ফাংশনটি থাকে)
        if (typeof playNotificationSound === 'function') {
            playNotificationSound();
        }

        // ৩. ব্যাজ কাউন্ট বাড়ানো
        const badge = document.querySelector('.nav-icon-btn .notification-badge');
        if(badge) { 
            let count = parseInt(badge.innerText) || 0;
            badge.innerText = count + 1; 
            badge.style.display = 'block'; 
        }

        // ৪. নোটিফিকেশন বক্সে সুন্দরভাবে যোগ করা
        if (typeof addNotificationToUI === 'function') {
            addNotificationToUI(data);
        } else {
            // যদি UI ফাংশন না থাকে (ব্যাকআপ)
            const notifBox = document.getElementById('notification-box');
            const div = document.createElement('div');
            div.className = 'notif-item';
            div.innerHTML = `<p>${data.message}</p>`;
            notifBox.appendChild(div);
        }
    }
});

// ২. ব্যাজ কাউন্ট বাড়ানো
function increaseBadgeCount() {
    const badge = document.querySelector('.nav-icon-btn .notification-badge');
    if(badge) {
        let count = parseInt(badge.innerText) || 0;
        badge.innerText = count + 1;
        badge.style.display = 'block';
    }
}

// ৩. নোটিফিকেশন লিস্টে যোগ করা
function addNotificationToUI(data) {
    const notifBox = document.getElementById('notification-box');
    
    // আইকন সেট করা
    let icon = '🔔';
    if (data.type === 'like') icon = '❤️';
    if (data.type === 'coin') icon = '🪙';
    if (data.type === 'comment') icon = '💬';
    if (data.type === 'message') icon = '📨';
    if (data.type === 'upload') icon = '🎬';

    const div = document.createElement('div');
    div.className = 'notif-item';
    div.style.cssText = "padding:10px; border-bottom:1px solid #f0f2f5; cursor:pointer; display:flex; gap:10px; align-items:center; background:white;";
    
    div.innerHTML = `
        <div style="font-size:20px; min-width:30px; text-align:center;">${icon}</div>
        <div>
            <p style="margin:0; font-size:13px; font-weight:500;">${data.message}</p>
            <span style="font-size:10px; color:gray;">Just now</span>
        </div>
    `;

    // ক্লিক ইভেন্ট
    div.onclick = function() {
        if(data.type === 'message') {
            openChat(data.sender);
        } else {
            // পোস্ট ভিউ বা অন্য অ্যাকশন
            alert("ডিটেইলস দেখাচ্ছে..."); 
        }
    };

    // 👇 হেডার (h4) এর ঠিক পরে নতুন নোটিফিকেশন বসানো (সবচেয়ে উপরে)
    const header = notifBox.querySelector('h4');
    if (header && header.nextSibling) {
        notifBox.insertBefore(div, header.nextSibling);
    } else {
        notifBox.appendChild(div);
    }
}

// ৪. সাউন্ড (অপশনাল)
function playNotificationSound() {
    const audio = new Audio('https://upload.wikimedia.org/wikipedia/commons/2/29/Chime-bell-ding.wav'); // উদাহরণ সাউন্ড
    audio.play().catch(e => console.log(e));
}

// ৫. নোটিফিকেশন টগল (আগেরটা আপডেট)
async function toggleNotifications() {
    const box = document.getElementById('notification-box');
    
    if (box.style.display === 'none') {
        box.style.display = 'block';
        // খুললে ব্যাজ ০ করে দেওয়া
        const badge = document.querySelector('.nav-icon-btn .notification-badge');
        badge.innerText = '0';
        badge.style.display = 'none';
        
        // এখানে চাইলে সার্ভার থেকে পুরনো নোটিফিকেশন লোড করার API কল করতে পারেন
    } else {
        box.style.display = 'none';
    }
}

// ==========================================
// ৫. শর্টস (Shorts/Reels)
// ==========================================
// ১. শর্টস গ্রিড ভিউ
async function filterShorts() {
    console.log("Shorts Tab Clicked!");
    document.querySelectorAll('.b-nav-item').forEach(el => el.classList.remove('active-tab'));
    const navItems = document.querySelectorAll('.b-nav-item');
    if(navItems[3]) navItems[3].classList.add('active-tab'); 

    const feed = document.getElementById('feed');
    feed.innerHTML = '<div style="text-align:center; padding:50px;">⚡ শর্টস লোড হচ্ছে...</div>';

    try {
        const [postRes, userRes] = await Promise.all([ fetch('/posts'), fetch('/users') ]);
        const posts = await postRes.json();
        const allUsers = await userRes.json();
        
        const me = allUsers.find(u => u.username === currentUser);
        const myFollowing = me ? (me.following || []) : [];

        const shorts = posts.filter(p => p.isShort === true);

        if (shorts.length === 0) {
            feed.innerHTML = '<div class="card" style="padding:30px; text-align:center;">কোনো শর্টস নেই।</div>';
            return;
        }

        let html = '<div class="shorts-grid-container">';
        
        shorts.forEach(post => {
            // ফলো বাটন লজিক
            let followBtnHtml = '';
            if (post.username !== currentUser && !myFollowing.includes(post.username)) {
                followBtnHtml = `<button class="shorts-follow-btn" onclick="event.stopPropagation(); toggleConnection('${post.username}', 'connect')">Follow</button>`;
            }

            // কয়েন বাটন লজিক
            const hasCoined = post.coinedBy && post.coinedBy.includes(currentUser);
            const coinColor = hasCoined ? '#fbc02d' : 'white';
            const coinAction = hasCoined ? '' : `giveCoin('${post._id}')`;
            const timeString = timeAgo(post.createdAt);

            // 👇 onclick="openFullShorts(...)" এখানে ঠিক করা হয়েছে
            html += `
                <div class="shorts-grid-card" onclick="openFullShorts('${post._id}')">
                    <video src="${post.mediaUrl}" loop muted onmouseover="this.play()" onmouseout="this.pause()"></video>
                    
                    <div class="shorts-action-bar">
                        <div style="text-align:center;">
                            <button id="short-coin-btn-${post._id}" class="shorts-btn" onclick="event.stopPropagation(); ${coinAction}" style="color:${coinColor}">
                                <i class="fas fa-coins"></i>
                            </button>
                            <span id="short-coin-count-${post._id}" class="shorts-count">${post.coins || 0}</span>
                        </div>
                    </div>

                    <div class="shorts-info-overlay">
                        <div style="display:flex; align-items:center; gap:5px;">
                            <h4 style="margin:0;">@${post.username}</h4>
                            ${followBtnHtml}
                        </div>
                        <span style="font-size:10px; color:#ddd; display:block; margin-bottom:2px;">${timeString}</span>
                        <p class="shorts-caption">${post.caption || ''}</p>
                    </div>
                </div>`;
        });

        html += '</div>';
        feed.innerHTML = html;

    } catch(err) { 
        console.log(err);
        feed.innerHTML = '<p style="color:red; text-align:center;">সমস্যা হয়েছে!</p>';
    }
}

// ১. শর্টস ওপেন করা
async function openFullShorts(startPostId) {
    const modal = document.getElementById('full-shorts-modal');
    const container = document.getElementById('shorts-scroll-container');
    
    // ডাটা আনা
    try {
        const [postRes, userRes] = await Promise.all([ fetch('/posts'), fetch('/users') ]);
        const posts = await postRes.json();
        const allUsers = await userRes.json();

        // শুধু শর্টস ফিল্টার করা
        const allShorts = posts.filter(p => p.isShort === true);
        
        container.innerHTML = ''; // কন্টেইনার খালি করা

        // সব ভিডিও স্লাইড আকারে যোগ করা
        allShorts.forEach(post => {
            const slideHTML = renderShortSlide(post, allUsers);
            container.insertAdjacentHTML('beforeend', slideHTML);
        });

        // মোডাল দেখানো
        modal.style.display = 'block';

        // যে ভিডিওতে ক্লিক করেছেন সেখানে জাম্প করা
        const targetSlide = document.getElementById(`slide-${startPostId}`);
        if(targetSlide) {
            targetSlide.scrollIntoView({ behavior: 'auto' });
        }

        // 👇 অটো প্লে এবং পজ সেটআপ (Observer)
        setupVideoObserver();

    } catch(err) {
        console.log(err);
    }
}

// --- ২. স্লাইড তৈরির হেল্পার ফাংশন (প্রোগ্রেস বার সহ) ---
function renderShortSlide(post, allUsers) {
    const me = allUsers.find(u => u.username === currentUser);
    const myFollowing = me ? (me.following || []) : [];
    const owner = allUsers.find(u => u.username === post.username);
    const ownerPic = owner ? (owner.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png") : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

    // বাটন লজিক
    const coinAction = post.coinedBy && post.coinedBy.includes(currentUser) ? '' : `giveCoin('${post._id}')`;
    const coinColor = post.coinedBy && post.coinedBy.includes(currentUser) ? '#fbc02d' : 'white';

    // 👇 ফলো বাটন লজিক (+5 কয়েন সহ)
    let followBtn = '';
    if (post.username !== currentUser) {
        if (myFollowing.includes(post.username)) {
            // যদি ফলো করা থাকে
            followBtn = `<button class="short-follow-btn following" onclick="toggleConnection('${post.username}', 'unconnect')">Following</button>`;
        } else {
            // যদি ফলো করা না থাকে (+5 কয়েন দেখাবে)
            followBtn = `<button class="short-follow-btn" onclick="toggleConnection('${post.username}', 'connect')">Follow <span style="color:#e65100;">+5🪙</span></button>`;
        }
    }
    // HTML স্ট্রাকচার
    return `
    <div class="short-slide" id="slide-${post._id}">
        <div onclick="openShortsMenu('${post._id}', '${post.username}', '${post.mediaUrl}')" 
            style="position: absolute; top: 20px; right: 20px; z-index: 25; color: white; font-size: 24px; cursor: pointer; text-shadow: 0 2px 5px black;">
            <i class="fas fa-ellipsis-v"></i>
        </div>

        <!-- ভিডিও -->
        <video src="${post.mediaUrl}" loop class="reel-video" onclick="toggleVideo(this)"></video>

        <!-- ডান পাশের অ্যাকশন বাটন -->
        <div class="shorts-right-actions" style="z-index:20; right:15px; bottom:120px; position:absolute; display:flex; flex-direction:column; gap:20px; align-items:center; color:white;">
            
            <div onclick="${coinAction}" style="cursor:pointer; color:${coinColor}; font-size:28px; text-shadow:0 2px 5px black;">
                <i class="fas fa-coins"></i>
            </div>
            <span style="font-size:12px; font-weight:bold; margin-top:-15px;">${post.coins || 0}</span>
            
            <div onclick="openShortsComments('${post._id}')" style="cursor:pointer; font-size:28px; text-shadow:0 2px 5px black;">
                <i class="fas fa-comment-dots"></i>
            </div>
            <span style="font-size:12px; font-weight:bold; margin-top:-15px;">${post.comments ? post.comments.length : 0}</span>

            <div onclick="sharePost('${post.mediaUrl}')" style="cursor:pointer; font-size:28px; text-shadow:0 2px 5px black;">
                <i class="fas fa-share"></i>
            </div>
            <span style="font-size:12px; font-weight:bold; margin-top:-15px;">Share</span>
        </div>

        <!-- নিচের ইনফো -->
        <div class="shorts-bottom-info" style="z-index:20; left:15px; bottom:30px; position:absolute; width:80%;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <img src="${ownerPic}" style="width:45px; height:45px; border-radius:50%; border:2px solid white; cursor:pointer;" onclick="closeFullShorts(); viewUserProfile('${post.username}')">
                <div style="display:flex; flex-direction:column;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <h4 style="margin:0; color:white; text-shadow:1px 1px 2px black; font-size:16px;">@${post.username}</h4>
                        ${followBtn}
                    </div>
                </div>
            </div>
            <p style="color:white; margin:0; text-shadow:1px 1px 2px black; font-size:14px;">${post.caption || ''}</p>
        </div>

        <!-- 👇 নতুন: ভিডিও প্রোগ্রেস বার -->
        <input type="range" class="video-progress" min="0" max="100" value="0" step="0.1" oninput="seekShortVideo(this)">
    </div>`;
}
// --- ৩. স্ক্রল এবং প্লে কন্ট্রোল (বার আপডেট সহ) ---
function setupVideoObserver() {
    const videos = document.querySelectorAll('.reel-video');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            const slide = video.closest('.short-slide'); // ভিডিওর প্যারেন্ট ডিভ
            const progressBar = slide.querySelector('.video-progress'); // সেই স্লাইডের প্রোগ্রেস বার

            if (entry.isIntersecting) {
                video.play();
                const postId = slide.id.replace('slide-', '');
                claimWatchReward(postId);
                // 👇 ভিডিও চলার সাথে বার আপডেট করা
                video.ontimeupdate = function() {
                    if (video.duration) {
                        const percent = (video.currentTime / video.duration) * 100;
                        progressBar.value = percent;
                    }
                };

            } else {
                video.pause();
                video.currentTime = 0;
                progressBar.value = 0; // বার রিসেট
            }
        });
    }, { threshold: 0.6 });

    videos.forEach(video => observer.observe(video));
}

// --- নতুন: ভিডিও টেনে দেখা (Seek) ---
function seekShortVideo(input) {
    // ইনপুট যে স্লাইডে আছে, সেই স্লাইডের ভিডিও খুঁজে বের করা
    const slide = input.closest('.short-slide');
    const video = slide.querySelector('video');
    
    if (video && video.duration) {
        const time = (input.value / 100) * video.duration;
        video.currentTime = time;
    }
}

// ভিডিওতে ক্লিক করলে প্লে/পজ
function toggleVideo(video) {
    if(video.paused) video.play();
    else video.pause();
}

// মোডাল বন্ধ করলে সব ভিডিও স্টপ
function closeFullShorts() {
    document.getElementById('full-shorts-modal').style.display = 'none';
    document.querySelectorAll('video').forEach(v => v.pause());
}
// ২. ভিডিও প্লে/পজ কন্ট্রোল
function toggleShortsPlay() {
    const video = document.getElementById('full-short-video');
    const icon = document.getElementById('play-pause-icon');
    
    if (video.paused) {
        video.play();
        if(icon) icon.style.display = 'none';
    } else {
        video.pause();
        if(icon) icon.style.display = 'block';
    }
}

// ৩. স্লাইডার টানলে ভিডিও আগানো (Seek)
function seekVideo() {
    const video = document.getElementById('full-short-video');
    const progressBar = document.getElementById('shorts-progress-bar');
    
    if (video && video.duration) {
        const time = (progressBar.value / 100) * video.duration;
        video.currentTime = time;
    }
}

// ৪. সময় ফরম্যাট (মিনিট:সেকেন্ড)
function formatTime(seconds) {
    if(isNaN(seconds)) return "00:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0'+sec : sec}`;
}

// ৫. শর্টস বন্ধ করা
function closeFullShorts() {
    const modal = document.getElementById('full-shorts-modal');
    const video = document.getElementById('full-short-video');
    
    if(video) video.pause();
    if(modal) modal.style.display = 'none';
    
    // পেজ রিফ্রেশ করে বাটন স্ট্যাটাস আপডেট রাখা
    filterShorts();
}
// ==========================================
// ৬. নেটওয়ার্ক জোন (Friends/Follow)
// ==========================================

async function showFriendsView() {
    // ১. টপ শর্টস বার লুকানো
    const topBar = document.getElementById('top-shorts-bar');
    if (topBar) topBar.style.display = 'none';

    // ২. ট্যাব স্টাইল ঠিক করা
    setActiveBottomTab(4); // Friends index

    const feed = document.getElementById('feed');
    feed.innerHTML = '<div style="text-align:center; padding:20px;">🔄 লোডিং...</div>';

    try {
        // ৩. ডাটা আনা
        const res = await fetch('/users');
        const allUsers = await res.json();
        
        const me = allUsers.find(u => u.username === currentUser);
        const myFollowing = me ? (me.following || []) : [];
        const myFollowers = me ? (me.followers || []) : [];

        // ৪. হেডার HTML (বাটন, সার্চ, ফোন কানেক্ট)
        let html = `
            <div class="card" style="padding: 20px; background:white;">
                <h2 style="margin:0 0 15px 0;">🔗 নেটওয়ার্ক জোন</h2>
                
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <button onclick="showNetworkList('following')" style="flex:1; background:#e7f3ff; color:#1877f2; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer;">
                        Following (${myFollowing.length})
                    </button>
                    <button onclick="showNetworkList('followers')" style="flex:1; background:#fff3cd; color:#f57f17; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer;">
                        Followers (${myFollowers.length})
                    </button>
                </div>

                <div class="friend-search-container" style="margin-bottom: 10px;">
                    <input type="text" id="friendSearch" class="friend-search-input" placeholder="🔍 নাম দিয়ে মানুষ খুঁজুন..." onkeyup="filterFriendsUI()" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 20px; outline:none;">
                </div>

                <div class="card" style="padding:10px; display:flex; gap:10px; background:#f3e5f5; border:1px solid #e1bee7; align-items:center;">
                    <input type="number" id="phoneInput" placeholder="📞 ফোন নম্বর দিয়ে ফলো করুন..." style="flex:1; padding:8px; border:none; outline:none; border-radius:5px; background:transparent;">
                    <button onclick="connectByPhone()" style="background:#8e24aa; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Add</button>
                </div>
            </div>

            <div id="friends-content-area">
                <h4 style="margin: 20px 0 10px 0;">🌐 নতুন মানুষ খুঁজুন</h4>
                <div class="user-card-item-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
        `;

        // ৫. ইউজার লুপ (নতুন মানুষ ফিল্টার)
        let found = false;
        allUsers.forEach(user => {
            // শর্ত: আমি না এবং অলরেডি ফলো করছি না
            if (user.username !== currentUser && !myFollowing.includes(user.username)) {
                found = true;
                const pic = user.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
                
                html += `
                <div class="card user-card-item" style="text-align:center; padding:15px; cursor:pointer;" onclick="viewUserProfile('${user.username}')">
                    <img src="${pic}" style="width:70px; height:70px; border-radius:50%; object-fit:cover; margin-bottom:10px;">
                    <h4 class="user-name-text" style="margin-bottom:5px;">${user.username}</h4>
                    
                    <!-- 👇 এই বাটনটি আপডেট করা হয়েছে (+5🪙 সহ) -->
                    <button onclick="event.stopPropagation(); toggleConnection('${user.username}', 'connect')" 
                            class="btn-secondary" 
                            style="width:100%; font-size:12px; border:1px solid #1877f2; color:#1877f2; background:white; font-weight:bold; cursor:pointer;">
                        Follow <span style="color:#f57f17;">+5🪙</span>
                    </button>
                </div>`;
            }
        });

        if(!found) html += `<p style="grid-column: 1/-1; text-align:center; color:gray;">নতুন কাউকে পাওয়া যায়নি।</p>`;
        html += `</div></div>`;
        feed.innerHTML = html;

    } catch (err) { 
        console.log(err); 
        feed.innerHTML = '<p style="color:red; text-align:center;">ডাটা লোড সমস্যা!</p>';
    }
}
// --- কানেক্ট/ফলো ফাংশন (কয়েন লজিক সহ) ---
async function toggleConnection(targetUser, action) {
    const url = action === 'connect' ? '/connect-user' : '/unconnect-user';
    
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: currentUser, targetUser: targetUser, receiver: targetUser })
        });

        const data = await res.json();
        
        // ব্যালেন্স আপডেট (উপরের বক্সে)
        if (data.success) {
            updateNavBalance(); // সার্ভার থেকে নতুন ব্যালেন্স আনবে
            
            // সাউন্ড ইফেক্ট (শুধু ফলো করলে)
            if (action === 'connect') {
                const audio = new Audio('https://upload.wikimedia.org/wikipedia/commons/2/29/Chime-bell-ding.wav');
                audio.play().catch(e => {});
            }
        }

        // --- বাটনের চেহারা পরিবর্তন (DOM Update) ---
        const allButtons = document.querySelectorAll(`.follow-btn-${targetUser}`);
        
        allButtons.forEach(btn => {
            if (action === 'connect') {
                // ফলো করার পর -> Following হয়ে যাবে (কয়েন লেখা চলে যাবে)
                btn.innerHTML = "Following";
                btn.style.color = "gray";
                btn.style.border = "none";
                btn.style.background = "transparent";
                
                // শর্টসের বাটন হলে স্টাইল একটু আলাদা
                if(btn.classList.contains('shorts-follow-btn')) {
                    btn.style.color = "white";
                    btn.style.border = "1px solid white";
                }
                
                btn.setAttribute('onclick', `event.stopPropagation(); toggleConnection('${targetUser}', 'unconnect')`);
            } 
            else {
                // আনফলো করার পর -> আবার Follow +5 হয়ে যাবে
                // হোম পেজের বাটন
                if(!btn.classList.contains('shorts-follow-btn')) {
                    btn.innerHTML = `Follow <span style="color:#f57f17;">+5🪙</span>`;
                    btn.style.color = "#1877f2";
                    btn.style.border = "1px solid #1877f2";
                    btn.style.background = "white";
                } 
                // শর্টসের বাটন
                else {
                    btn.innerHTML = `Follow <span style="color:#e65100;">+5</span>`;
                    btn.style.background = "white";
                    btn.style.color = "black";
                    btn.style.border = "none";
                }

                btn.setAttribute('onclick', `event.stopPropagation(); toggleConnection('${targetUser}', 'connect')`);
            }
        });

        // যদি নেটওয়ার্ক জোনে থাকি, তবে রিফ্রেশ
        const navItems = document.querySelectorAll('.b-nav-item');
        if (navItems[4] && navItems[4].classList.contains('active-tab')) {
            showFriendsView(); 
        }

    } catch(err) { console.log(err); }
}

// ==========================================
// ৭. প্রোফাইল এবং সেটিংস
// ==========================================

//async function viewUserProfile(username) {
    //document.getElementById('profile-modal').style.display = 'none';
   // if(username === currentUser) {
       // showMyProfile();
   // } else {
        //showUserProfile(username);
   // }
//}
// --- অন্যের ফুল প্রোফাইল দেখানোর ফাংশন ---
async function showUserProfile(targetUsername) {
    const feed = document.getElementById('feed');
    feed.innerHTML = '<div style="text-align:center; padding:20px;">প্রোফাইল লোড হচ্ছে...</div>';
    
    // ট্যাব রিসেট
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active-tab'));

    try {
        // ১. ডাটা আনা (ইউজার এবং পোস্ট)
        const [userRes, postRes] = await Promise.all([
            fetch('/users'),
            fetch('/posts')
        ]);

        const allUsers = await userRes.json();
        const allPosts = await postRes.json();

        // ২. টার্গেট ইউজার এবং আমার ডাটা বের করা
        const targetUser = allUsers.find(u => u.username === targetUsername);
        const myData = allUsers.find(u => u.username === currentUser);
        
        if (!targetUser) {
            feed.innerHTML = '<h3 style="text-align:center;">ইউজার পাওয়া যায়নি!</h3>';
            return;
        }

        // ৩. কানেকশন স্ট্যাটাস চেক করা
        const iAmFollowing = myData.following && myData.following.includes(targetUsername);
        
        // কানেক্ট বাটন ডিজাইন
        let followBtnHTML = '';
        if (iAmFollowing) {
            followBtnHTML = `
                <button onclick="toggleConnection('${targetUsername}', 'unconnect'); showUserProfile('${targetUsername}')" 
                        class="btn-primary" style="background:green; border:none; padding:8px 20px; border-radius:5px;">
                    <i class="fas fa-check"></i> Following
                </button>`;
        } else {
            followBtnHTML = `
                <button onclick="toggleConnection('${targetUsername}', 'connect'); showUserProfile('${targetUsername}')" 
                        class="btn-secondary" style="background:white; color:#1877f2; border:1px solid #1877f2; padding:8px 20px; border-radius:5px;">
                    <i class="fas fa-user-plus"></i> Follow
                </button>`;
        }

        // ৪. ওই ইউজারের পোস্ট ফিল্টার করা
        const targetPosts = allPosts.filter(p => p.username === targetUsername);
        const userPic = targetUser.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

        // কভার ফটো হ্যান্ডেলিং
        const coverStyle = targetUser.coverPic ? `background-image: url('${targetUser.coverPic}');` : 'background: linear-gradient(to right, #1877f2, #00c6ff);';

        // ৫. প্রোফাইল HTML তৈরি (কভার, ছবি, বাটন)
        let html = `
            <div class="profile-header-container">
                <!-- কভার ফটো -->
                <div class="profile-cover" style="${coverStyle} background-size: cover; background-position: center;">
                    <div class="profile-pic-wrapper">
                        <img src="${userPic}" class="my-profile-pic">
                    </div>
                </div>
                
                <!-- নাম ও অ্যাকশন বাটন -->
                <div class="profile-info-text">
                    <h1 style="margin-bottom:5px;">${targetUser.username}</h1>
                    <p class="profile-bio" style="margin-bottom:15px;">${targetUser.bio || "No bio available"}</p>
                    
                    <div style="display:flex; justify-content:center; gap:10px;">
                        ${followBtnHTML} <!-- কানেক্ট বাটন -->
                        
                        <button onclick="openChat('${targetUsername}')" class="btn-primary" style="padding:8px 20px; border-radius:5px;">
                            <i class="fab fa-facebook-messenger"></i> Message
                        </button>
                    </div>
                    
                    <div style="margin-top:15px; font-weight:bold; color:gray;">
                        <span>${targetUser.followers ? targetUser.followers.length : 0} Followers</span> • 
                        <span>${targetUser.following ? targetUser.following.length : 0} Following</span>
                    </div>
                </div>
                <hr style="margin:0;">
            </div>

            <h3 style="margin: 10px 0;">${targetUser.username}-এর পোস্টসমূহ (${targetPosts.length})</h3>
        `;

        // ৬. ফিডে বসানো
        feed.innerHTML = html;

        // ৭. পোস্ট দেখানো
        if (targetPosts.length === 0) {
            feed.innerHTML += '<div class="card" style="padding:20px; text-align:center;">কোনো পোস্ট নেই।</div>';
        } else {
            targetPosts.forEach(post => {
                createPostElement(post, feed, iAmFollowing);
            });
        }

    } catch (err) {
        console.log(err);
        feed.innerHTML = "সমস্যা হয়েছে!";
    }
}

async function showMyProfile() {
    document.getElementById('top-shorts-bar').style.display = 'none';
    setActiveBottomTab(0); // Profile index
    const feed = document.getElementById('feed');
    feed.innerHTML = '<div style="text-align:center; padding:20px;">প্রোফাইল লোড হচ্ছে...</div>';

    try {
        const [userRes, postRes] = await Promise.all([ fetch('/users'), fetch('/posts') ]);
        const allUsers = await userRes.json();
        const allPosts = await postRes.json();
        const me = allUsers.find(u => u.username === currentUser);
        
        const myCover = me.coverPic ? `url(${me.coverPic})` : 'linear-gradient(to right, #1877f2, #00c6ff)';
        const myPic = me.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
        const myPosts = allPosts.filter(p => p.username === currentUser);

        feed.innerHTML = `
            <div class="profile-header-container">
                <div class="profile-cover" style="background: ${myCover}; background-size: cover; background-position: center;">
                    <div class="profile-pic-wrapper">
                        <img src="${myPic}" class="my-profile-pic">
                        <i class="fas fa-camera" style="position:absolute; bottom:10px; right:10px; background:white; padding:5px; border-radius:50%; cursor:pointer;" onclick="openEditProfileModal()"></i>
                    </div>
                </div>
                <div class="profile-info-text">
                    <h1>${currentUser}</h1>
                    <p class="profile-bio">${me.bio || "Welcome!"}</p>
                    <button class="edit-btn" onclick="openEditProfileModal()"><i class="fas fa-pen"></i> Edit Profile</button>
                </div>
                <hr>
            </div>
            <h3 style="margin: 10px 0;">আপনার পোস্টসমূহ (${myPosts.length})</h3>
        `;
        myPosts.forEach(post => createPostElement(post, feed));
    } catch(err) { console.log(err); }
}

//async function showUserProfile(targetUsername) {
    //const feed = document.getElementById('feed');
    //feed.innerHTML = 'Loaidng...';
    // ... (অন্যের প্রোফাইল দেখানোর লজিক আগের মতোই থাকবে, স্পেস বাচানোর জন্য ছোট করলাম)
    // আপনি চাইলে আগের showUserProfile কোড এখানে বসাতে পারেন।
    // সিম্পল ভার্সন:
    //alert("অন্যের প্রোফাইল দেখাচ্ছে: " + targetUsername);
    //loadPosts(); // আপাতত হোম দেখাচ্ছে

function viewUserProfile(username) {
    document.getElementById('top-shorts-bar').style.display = 'none';
    // ১. পপ-আপ মোডাল বন্ধ রাখা (যদি খোলা থাকে)
    document.getElementById('profile-modal').style.display = 'none';

    // ২. যদি নিজের নাম হয় -> নিজের প্রোফাইল দেখাবে
    if (username === currentUser) {
        showMyProfile();
    } 
    // ৩. যদি অন্য কেউ হয় -> তার পাবলিক প্রোফাইল দেখাবে
    else {
        showUserProfile(username);
    }
}


// --- মোডাল বন্ধ করার ফাংশন ---
function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}

// মোডালের বাইরে ক্লিক করলে বন্ধ হবে
window.onclick = function(event) {
    const modal = document.getElementById('profile-modal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// ==========================================
// আপলোড ফাংশন (ছবি, ভিডিও বা শুধু টেক্সট)
// ==========================================
async function uploadPost() {
    // ১. ইনপুট এলিমেন্টগুলো ধরা
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0]; // আসল ফাইল
    
    const caption = document.getElementById('postCaption').value;
    const location = document.getElementById('postLocation').value;
    const privacy = document.getElementById('postPrivacy').value;
    const isShort = document.getElementById('shortCheck').checked;

    // ২. ভ্যালিডেশন: ফাইল অথবা ক্যাপশন, অন্তত একটি থাকতেই হবে
    if (!file && !caption.trim()) {
        return alert("দয়া করে ছবি/ভিডিও সিলেক্ট করুন অথবা কিছু লিখুন!");
    }

    // ৩. ডাটা তৈরি করা (FormData)
    const formData = new FormData();
    formData.append('username', currentUser);
    
    // ফাইল থাকলে অ্যাপেন্ড করা হবে
    if (file) {
        formData.append('mediaFile', file);
    }

    formData.append('caption', caption);
    formData.append('location', location);
    formData.append('privacy', privacy);
    formData.append('isShort', isShort); // সার্ভারে বলা হচ্ছে এটা শর্ট ভিডিও কিনা

    // ৪. বাটন লোডিং ইফেক্ট (UX ভালো করার জন্য)
    const postBtn = document.querySelector('#post-modal .btn-primary');
    const originalText = postBtn.innerText;
    postBtn.innerText = "Uploading...";
    postBtn.disabled = true;

    try {
        // ৫. সার্ভারে পাঠানো
        const res = await fetch('/upload', { 
            method: 'POST', 
            body: formData 
        });
        
        const data = await res.json();
        
        if (data.success || data.message === "Upload Successful") {
            alert("✅ আপলোড সফল হয়েছে!");
            
            // ৬. ইনপুট ক্লিয়ার এবং মোডাল বন্ধ করা
            closePostModal();
            document.getElementById('fileInput').value = ""; 
            document.getElementById('postCaption').value = ""; 
            document.getElementById('postLocation').value = ""; 
            document.getElementById('shortCheck').checked = false;
            
            // ৭. সঠিক পেজ রিফ্রেশ করা
            if (isShort) {
                filterShorts(); // শর্টস আপলোড করলে শর্টস পেজ লোড হবে
            } else {
                loadPosts(); // সাধারণ পোস্ট হলে হোম পেজ লোড হবে
            }
        } else {
            alert("❌ ব্যর্থ: " + (data.error || "অজানা সমস্যা"));
        }

    } catch (err) {
        console.log(err);
        alert("সার্ভারে সংযোগ করা যাচ্ছে না!");
    } finally {
        // বাটন আগের অবস্থায় ফিরিয়ে আনা
        postBtn.innerText = originalText;
        postBtn.disabled = false;
    }
}

// ==========================================
// পোস্ট মেনু টগল (Three Dots Menu)
// ==========================================
function togglePostMenu(postId) {
    const menu = document.getElementById(`menu-${postId}`);
    
    // ১. অন্য সব খোলা মেনু বন্ধ করা (যাতে একবারে একটাই খোলা থাকে)
    document.querySelectorAll('.post-dropdown-menu').forEach(m => {
        if(m.id !== `menu-${postId}`) {
            m.style.display = 'none';
        }
    });

    // ২. বর্তমান মেনু টগল করা (Open/Close)
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
    } else {
        menu.style.display = 'block';
    }
}

// ৩. স্ক্রিনের অন্য কোথাও ক্লিক করলে মেনু বন্ধ হবে
window.onclick = function(event) {
    if (!event.target.matches('.three-dots-btn')) {
        document.querySelectorAll('.post-dropdown-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
    // মোডাল বন্ধ করার লজিক (যদি প্রোফাইল বা পোস্ট মোডালের বাইরে ক্লিক পড়ে)
    const profileModal = document.getElementById('profile-modal');
    if (event.target == profileModal) profileModal.style.display = "none";
    
    const postModal = document.getElementById('post-modal');
    if (event.target == postModal) postModal.style.display = "none";
}


// --- পোস্ট ডিলিট ফাংশন ---
async function deletePost(postId) {
    if (!confirm("আপনি কি নিশ্চিত এই পোস্টটি ডিলিট করতে চান?")) return;

    try {
        const res = await fetch(`/delete-post/${postId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser }) // প্রমাণ পাঠানো যে আমিই মালিক
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            location.reload(); // পেজ রিলোড দিলে পোস্ট চলে যাবে
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("ডিলিট করতে সমস্যা হয়েছে!");
    }
}

// --- মিডিয়া ডাউনলোড ফাংশন ---
async function downloadMedia(url, type) {
    if (!url || url === 'undefined') return alert("ডাউনলোড করার মতো কিছু নেই!");

    try {
        // ফাইলটি ফেচ করে ব্লব (Blob) আকারে আনা
        const response = await fetch(url);
        const blob = await response.blob();
        
        // ডাউনলোড লিংক তৈরি
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        
        // ফাইলের নাম দেওয়া
        const extension = type === 'video' ? 'mp4' : 'jpg';
        link.download = `socialapp_post_${Date.now()}.${extension}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert("ডাউনলোড শুরু হয়েছে...");
    } catch (err) {
        console.error(err);
        // যদি ওপরের নিয়মে না হয়, সরাসরি লিংকে পাঠাবে
        window.open(url, '_blank');
    }
}

// ==========================================
// ৮. সার্চ, চ্যাট এবং ইউটিলিটি

// ==========================================
// ১. এন্টার চাপলে বা আইকনে ক্লিক করলে সার্চ শুরু হবে
function handleSearch(event) {
    if (event.key === 'Enter' || event.type === 'click') {
        const query = document.getElementById('searchInput').value;
        if (query) {
            searchWeb(query);
        } else {
            alert("দয়া করে কিছু লিখুন...");
        }
    }
}

// --- VidMate স্টাইল গ্লোবাল সার্চ (Download বাটন সরানো হয়েছে) ---
async function searchWeb(query) {
    // UI সেটআপ
    const feed = document.getElementById('feed');
    const createBox = document.getElementById('create-post-box');
    const topShorts = document.getElementById('top-shorts-bar');
    const resultBox = document.getElementById('global-search-results');
    const grid = document.getElementById('web-results-grid');

    if(feed) feed.style.display = 'none';
    if(createBox) createBox.style.display = 'none';
    if(topShorts) topShorts.style.display = 'none'; 
    
    resultBox.style.display = 'block';
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px;"><h3>🔄 যাচাই করা হচ্ছে...</h3></div>';

    // ==========================================
    // ১. যদি ইনপুটটি একটি URL (লিংক) হয়
    // ==========================================
    if (isValidUrl(query)) {
        grid.innerHTML = ''; // লোডিং ক্লিয়ার
        
        // ক. যদি ইউটিউব লিংক হয়
        const ytID = getYoutubeID(query);
        if (ytID) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center;">
                    <h3 style="color:red; margin-bottom:10px;">YouTube Link Detected</h3>
                    <div class="shorts-grid-card" style="height:auto; background:white; max-width:400px; margin:0 auto;">
                        <img src="https://img.youtube.com/vi/${ytID}/hqdefault.jpg" style="width:100%; border-radius:10px;">
                        <div style="padding:10px; display:flex; gap:10px;">
                            <button onclick="playYoutubeVideo('${ytID}')" class="btn-primary" style="width:100%; background:red;">Play Now</button>
                        </div>
                    </div>
                </div>`;
        } 
        // খ. যদি অন্য কোনো লিংক হয়
        else {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:20px; background:#f0f2f5; border-radius:10px;">
                    <h3 style="color:#1877f2;">🌐 Website / Video Link</h3>
                    <p style="word-break:break-all;">${query}</p>
                    <div style="margin-top:15px;">
                        <a href="${query}" target="_blank" class="btn-primary" style="text-decoration:none; padding:10px 20px;">Open Link</a>
                        <br><br>
                        ${query.match(/\.(mp4|webm)$/) ? 
                          `<video src="${query}" controls style="width:100%; max-width:400px; border-radius:10px; margin-top:10px;"></video>` 
                          : ''}
                    </div>
                </div>`;
        }
        return; 
    }

    // ==========================================
    // ২. যদি সাধারণ টেক্সট সার্চ হয়
    // ==========================================
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px;"><h3>🔄 অ্যাপ এবং ওয়েবে খোঁজা হচ্ছে...</h3></div>';

    try {
        // ১. লোকাল সার্চ
        const localRes = await fetch(`/global-search/${query}`);
        const localData = await localRes.json();

        // ২. ইউটিউব সার্চ
        const API_KEY = 'AIzaSyCM_Flf8sU5UrZ9FLFDuNudsj3rkWrApgA'; 
        const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&maxResults=8&type=video&key=${API_KEY}`;
        const ytRes = await fetch(ytUrl);
        const ytData = await ytRes.json();

        grid.innerHTML = ''; 

        // --- অ্যাপ রেজাল্ট (User) ---
        if (localData.users && localData.users.length > 0) {
            grid.innerHTML += `<h4 style="grid-column: 1/-1; margin: 10px 0; color: #1877f2;">👤 অ্যাপের মানুষজন</h4>`;
            localData.users.forEach(user => {
                const pic = user.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
                grid.innerHTML += `
                    <div class="card" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer;" onclick="viewUserProfile('${user.username}')">
                        <img src="${pic}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                        <h4>${user.username}</h4>
                    </div>`;
            });
        }

        // --- অ্যাপ রেজাল্ট (Post) ---
        if (localData.posts && localData.posts.length > 0) {
            grid.innerHTML += `<h4 style="grid-column: 1/-1; margin: 20px 0 10px 0; color: #f57f17;">📝 অ্যাপের পোস্টসমূহ</h4>`;
            localData.posts.forEach(post => {
                let mediaHtml = post.mediaType === 'video' ? 
                    `<video src="${post.mediaUrl}" style="width:100%; height:150px; object-fit:cover;"></video>` : 
                    `<img src="${post.mediaUrl}" style="width:100%; height:150px; object-fit:cover;">`;
                
                grid.innerHTML += `
                    <div class="card" style="overflow:hidden; cursor:pointer;" onclick="alert('পোস্ট আইডি: ${post._id}')">
                        ${mediaHtml}
                        <div style="padding:10px;">
                            <h5 style="margin:0;">@${post.username}</h5>
                            <p style="font-size:12px; color:gray;">${post.caption || ''}</p>
                        </div>
                    </div>`;
            });
        }

        // --- ইউটিউব রেজাল্ট (Download বাটন সরানো হয়েছে) ---
        if (ytData.items) {
            grid.innerHTML += `<h4 style="grid-column: 1/-1; margin: 20px 0 10px 0; color: red;">📺 YouTube Video</h4>`;
            ytData.items.forEach(item => {
                const videoId = item.id.videoId;
                const title = item.snippet.title;
                const thumb = item.snippet.thumbnails.medium.url;

                grid.innerHTML += `
                    <div class="shorts-grid-card" style="height:260px; background:white; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                        <img src="${thumb}" style="width:100%; height:150px; object-fit:cover;" onclick="playYoutubeVideo('${videoId}')">
                        <div style="padding:10px;">
                            <h4 style="margin:0; font-size:13px; color:black; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${title}</h4>
                            <div style="margin-top:10px;">
                                <!-- 👇 শুধু Play বাটন রাখা হয়েছে -->
                                <button onclick="playYoutubeVideo('${videoId}')" style="width:100%; background:red; color:white; border:none; padding:5px; border-radius:5px; cursor:pointer;">Play</button>
                            </div>
                        </div>
                    </div>`;
            });
        }

        addExternalLinks(query);

    } catch (err) {
        console.log(err);
        grid.innerHTML = '<p style="color:red; text-align:center;">সার্চ করতে সমস্যা হয়েছে!</p>';
    }
}

// --- ইউটিউব ভিডিও প্লেয়ার (Back + Close বাটন সহ) ---
function playYoutubeVideo(videoId) {
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    
    const modal = document.getElementById('post-modal'); 
    const content = modal.querySelector('.modal-content');
    
    // ভিডিও এবং কন্ট্রোল বাটন সেট করা
    content.innerHTML = `
        <div style="background: black; width: 100%; height: 100%; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;">
            
            <!-- ১. হেডার বার (Back & Close) -->
            <div style="padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; background: #222; border-bottom: 1px solid #333;">
                
                <!-- Back বাটন (সার্চ রেজাল্টে ফিরে যাবে) -->
                <button onclick="closeVideoPlayer()" 
                        style="background: transparent; color: white; border: none; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                    <i class="fas fa-arrow-left"></i> Back
                </button>

                <!-- Close বাটন (হোম পেজে নিয়ে যাবে) -->
                <button onclick="closeGlobalSearch(); closeVideoPlayer();" 
                        style="background: red; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-times"></i>
                </button>

            </div>

            <!-- ২. ইউটিউব আইফ্রেম -->
            <iframe width="100%" height="450" src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="flex: 1;"></iframe>
        </div>
    `;
    
    modal.style.display = 'flex';
}

// --- ভিডিও প্লেয়ার বন্ধ করা (Back বাটনের জন্য) ---
function closeVideoPlayer() {
    const modal = document.getElementById('post-modal');
    const content = modal.querySelector('.modal-content');
    modal.style.display = 'none';
    content.innerHTML = ''; // ভিডিও স্টপ করার জন্য
}
// ৪. অন্য সাইটের লিংক বাটন (সহায়ক ফাংশন)
function addExternalLinks(query) {
    const grid = document.getElementById('web-results-grid');
    
    const div = document.createElement('div');
    div.style.gridColumn = "1 / -1";
    div.style.marginTop = "20px";
    div.style.padding = "10px";
    div.style.background = "#f0f2f5";
    div.style.borderRadius = "8px";

    div.innerHTML = `
        <h4 style="margin-bottom:10px;">অন্যান্য সাইটে খুঁজুন:</h4>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <a href="https://www.facebook.com/search/top?q=${query}" target="_blank" class="btn-primary" style="background:#1877f2; text-decoration:none; padding:5px 10px; border-radius:5px; color:white;">Facebook</a>
            <a href="https://www.tiktok.com/search?q=${query}" target="_blank" class="btn-primary" style="background:black; text-decoration:none; padding:5px 10px; border-radius:5px; color:white;">TikTok</a>
            <a href="https://www.instagram.com/explore/tags/${query}/" target="_blank" class="btn-primary" style="background:#e1306c; text-decoration:none; padding:5px 10px; border-radius:5px; color:white;">Instagram</a>
            <a href="https://play.google.com/store/search?q=${query}" target="_blank" class="btn-primary" style="background:green; text-decoration:none; padding:5px 10px; border-radius:5px; color:white;">Play Store</a>
        </div>
    `;
    grid.appendChild(div);
}

// ৫. সার্চ বন্ধ করা
function closeGlobalSearch() {
    document.getElementById('global-search-results').style.display = 'none';
    const feed = document.getElementById('feed');
    const createBox = document.getElementById('create-post-box');
    
    if(feed) feed.style.display = 'block';
    if(createBox) createBox.style.display = 'block';
    
    document.getElementById('searchInput').value = '';
}
// --- দরকারি ছোট ফাংশন ---
function openPostModal() { document.getElementById('post-modal').style.display = 'flex'; }
function closePostModal() { document.getElementById('post-modal').style.display = 'none'; }
function previewFile() { 
    const file = document.getElementById('fileInput').files[0];
    const previewBox = document.getElementById('file-preview');
    
    if (file) {
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('image')) {
            previewBox.innerHTML = `<img src="${url}" style="width:100%; max-height:200px; object-fit:contain;">`;
        } else {
            previewBox.innerHTML = `<video src="${url}" controls style="width:100%; max-height:200px;"></video>`;
        }
    }/* ... আগের কোড ... */ 
}

function toggleUploadMenu() { 
    const menu = document.getElementById('upload-dropdown');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}
function selectUploadType(type) { 
    /* ... আগের কোড ... */
 }
async function openCameraMode(mode) { 
   document.getElementById('upload-dropdown').style.display = 'none';
    
    const modal = document.getElementById('camera-stream-modal');
    const video = document.getElementById('video-feed');
    const status = document.getElementById('camera-status');
    const captureBtn = document.getElementById('capture-btn');
    const liveBtn = document.getElementById('go-live-btn');

    // মোডাল দেখানো
    modal.style.display = 'flex';

    // মোড চেক করা (Photo নাকি Live)
    if (mode === 'live') {
        status.innerText = "🔴 Ready for Live";
        captureBtn.style.display = 'none';
        liveBtn.style.display = 'block';
        liveBtn.innerText = "GO LIVE";
        liveBtn.style.background = "red";
    } else {
        status.innerText = "📷 Camera Mode";
        captureBtn.style.display = 'block';
        liveBtn.style.display = 'none';
    }

    // ব্রাউজারের ক্যামেরা চালু করা
    try {
        // ভিডিও এবং অডিও পারমিশন চাওয়া
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" }, // সামনের ক্যামেরা (user) বা পেছনের (environment)
            audio: (mode === 'live') // লাইভ হলে অডিও নিবে
        });
        
        video.srcObject = mediaStream; // ভিডিও ট্যাগে ক্যামেরা ফিড দেখানো
    } catch (err) {
        console.log(err);
        alert("ক্যামেরা চালু করা যাচ্ছে না! দয়া করে ব্রাউজারের পারমিশন চেক করুন।");
        closeCameraMode();
    } /* ... আগের কোড ... */
}
//function closeCameraMode() { document.getElementById('camera-stream-modal').style.display = 'none'; }
// ২. ক্যামেরা বন্ধ করা
function closeCameraMode() {
    const modal = document.getElementById('camera-stream-modal');
    modal.style.display = 'none';

    // হার্ডওয়্যার ক্যামেরা অফ করা
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

function capturePhoto() {
    const video = document.getElementById('video-feed');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');

    // ক্যানভাসে ভিডিওর সাইজ সেট করা
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // ভিডিওর বর্তমান ফ্রেম ক্যানভাসে আঁকা
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // ক্যানভাস থেকে ছবি ফাইলে রূপান্তর
    canvas.toBlob(blob => {
        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });

        closeCameraMode(); // ক্যামেরা বন্ধ
        openPostModal();   // পোস্ট মোডাল ওপেন

        // আমাদের কাস্টম ইনপুটে ফাইল সেট করা
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('fileInput').files = dataTransfer.files;

        // প্রিভিউ দেখানো
        previewFile(); 

    }, 'image/jpeg');
     /* ... আগের কোড ... */ 
}

// ৪. লাইভ শুরু (সিমুলেশন)
function startLiveStream() {
    const liveBtn = document.getElementById('go-live-btn');
    
    if (liveBtn.innerText === "GO LIVE") {
        liveBtn.innerText = "🔴 LIVE NOW (Click to End)";
        liveBtn.style.background = "green";
        
        // সার্ভারে নোটিফিকেশন পাঠানো
        if (typeof socket !== 'undefined') {
            socket.emit('start_live', { username: currentUser });
        }
        alert("আপনি এখন লাইভে আছেন! নোটিফিকেশন পাঠানো হয়েছে।");
    } else {
        closeCameraMode();
        alert("লাইভ শেষ হয়েছে।");
    }
}

// --- ১. আপলোড মেনু টগল ---
function toggleUploadMenu() {
    const menu = document.getElementById('upload-dropdown');
    
    // অন্য সব মেনু বন্ধ করা
    document.getElementById('settings-dropdown').style.display = 'none';
    document.getElementById('notification-box').style.display = 'none';
    document.getElementById('messenger-dropdown').style.display = 'none';

    if (menu.style.display === 'block') {
        menu.style.display = 'none';
    } else {
        menu.style.display = 'block';
    }
}

// --- ২. ফটো, ভিডিও বা শর্ট সিলেক্ট করা ---
function selectUploadType(type) {
    // মেনু বন্ধ করা
    document.getElementById('upload-dropdown').style.display = 'none';
    
    // পোস্ট মোডাল ওপেন করা
    openPostModal();

    // শর্ট ভিডিও হলে টিক দেওয়া
    const shortCheck = document.getElementById('shortCheck');
    if (type === 'short') {
        shortCheck.checked = true;
    } else {
        shortCheck.checked = false;
    }

    // ফাইল ইনপুট ওপেন করা (যাতে ইউজার সরাসরি ফাইল বাছতে পারে)
    // ১ সেকেন্ড পর ওপেন হবে যাতে মোডালটা আগে লোড হয়
    setTimeout(() => {
        document.getElementById('fileInput').click();
    }, 500);
}

// --- ৩. ক্যামেরা ওপেন করা ---

// --- ৪. ক্যামেরা দিয়ে ছবি তোলার পর যা হবে ---
function handleCameraUpload() {
    const cameraFile = document.getElementById('cameraInput').files[0];
    
    if (cameraFile) {
        openPostModal(); // মোডাল ওপেন
        
        // ফাইল প্রিভিউ দেখানোর জন্য আমাদের আগের লজিক ব্যবহার করব
        // কিন্তু আমাদের আগের previewFile() ফাংশন 'fileInput' আইডি খুঁজে
        // তাই আমরা কোড দিয়ে 'fileInput' এ ক্যামেরার ফাইলটি সেট করে দেব
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(cameraFile);
        document.getElementById('fileInput').files = dataTransfer.files;

        // প্রিভিউ কল করা
        previewFile();
    }
}
// --- অডিও/ভিডিও কল ফাংশন (Simulation) ---
function startCall(type) {
    if (!currentChatFriend) return;

    const callType = type === 'video' ? 'ভিডিও' : 'অডিও';
    
    // ১. সাউন্ড বাজানো (Ringtone)
    const ringtone = new Audio('https://upload.wikimedia.org/wikipedia/commons/e/e9/Ringtone_%283%29.ogg'); 
    ringtone.play().catch(e => {});

    // ২. নোটিফিকেশন পাঠানো (যাকে কল দিচ্ছি)
    if (typeof socket !== 'undefined') {
        socket.emit('new_notification', {
            sender: currentUser,
            receiver: currentChatFriend,
            type: 'message', // অথবা 'call' টাইপ বানাতে পারেন
            message: `📞 ${currentUser} আপনাকে ${callType} কল করছেন...`,
            postId: null
        });
    }

    // ৩. কলিং স্ক্রিন দেখানো (সিমুলেশন)
    const msgBox = document.getElementById('chat-messages');
    const callDiv = document.createElement('div');
    callDiv.style.cssText = "text-align:center; padding:20px; background:rgba(0,0,0,0.05); border-radius:10px; margin:10px 0;";
    callDiv.innerHTML = `
        <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" width="60" style="border-radius:50%; margin-bottom:10px;">
        <h4>Calling ${currentChatFriend}...</h4>
        <p>Ringing...</p>
        <button onclick="this.parentElement.remove(); ringtone.pause();" style="background:red; color:white; border:none; padding:10px 20px; border-radius:20px; cursor:pointer;">End Call</button>
    `;
    msgBox.appendChild(callDiv);
    msgBox.scrollTop = msgBox.scrollHeight;
}

// --- মেসেঞ্জারের ভেতর ফোন কানেক্ট লজিক ---

// ১. বক্স টগল করা (Open/Close)
function togglePhoneSearch() {
    const box = document.getElementById('msg-phone-box');
    if (box.style.display === 'none') {
        box.style.display = 'flex';
        document.getElementById('msgPhoneInput').focus(); // ফোকাস ইনপুটে যাবে
    } else {
        box.style.display = 'none';
    }
}

// ২. নম্বর দিয়ে কানেক্ট এবং চ্যাট শুরু করা
async function quickPhoneConnect() {
    const mobile = document.getElementById('msgPhoneInput').value;
    if (!mobile) return alert("দয়া করে একটি নম্বর দিন!");

    // লোডিং বাটন ইফেক্ট
    const btn = document.querySelector('#msg-phone-box button');
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        // আমাদের আগের তৈরি করা API ব্যবহার করছি
        const res = await fetch('/connect-by-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: currentUser, mobile: mobile })
        });
        
        const data = await res.json();

        if (data.success) {
            // সফল হলে ইনপুট বক্স বন্ধ হবে
            document.getElementById('msg-phone-box').style.display = 'none';
            document.getElementById('msgPhoneInput').value = '';
            
            // মেসেঞ্জার ড্রপডাউন বন্ধ হবে
            document.getElementById('messenger-dropdown').style.display = 'none';

            // সরাসরি চ্যাট বক্স ওপেন হবে (যাকে কানেক্ট করলেন তার সাথে)
            // সার্ভার থেকে ইউজারনেম ফেরত না আসলে আমরা সার্চ করে বের করতে পারি
            // তবে সহজ করার জন্য আমরা আবার লিস্ট লোড করে ওপেন করব
            alert(data.message);
            
            // নতুন বন্ধুকে চ্যাট লিস্টে আনতে পেজ রিফ্রেশ বা লিস্ট রিফ্রেশ
            toggleMessenger(); // লিস্ট রিফ্রেশ হবে
            
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert("সমস্যা হয়েছে!");
    } finally {
        btn.innerHTML = originalIcon; // বাটন আগের অবস্থায়
    }
}
function toggleMessenger() { document.getElementById('messenger-dropdown').style.display = 'block'; }
async function toggleSettingsMenu() { 
    const menu = document.getElementById('settings-dropdown');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}


// --- Following বা Followers লিস্ট দেখানোর ফাংশন ---
async function showNetworkList(type) {
    const contentArea = document.getElementById('friends-content-area');
    contentArea.innerHTML = '<div style="text-align:center; padding:20px;">লিস্ট লোড হচ্ছে...</div>';

    try {
        const res = await fetch('/users');
        const allUsers = await res.json();
        const myData = allUsers.find(u => u.username === currentUser);

        let targetList = [];
        let title = "";

        // চেক করা কোন বাটনে ক্লিক পড়েছে
        if (type === 'following') {
            targetList = myData.following || [];
            title = `যাদের আমি ফলো করছি (${targetList.length})`;
        } else {
            targetList = myData.followers || [];
            title = `যারা আমাকে ফলো করছে (${targetList.length})`;
        }

        // HTML তৈরি
        let html = `
            <button onclick="showFriendsView()" style="margin-bottom:15px; cursor:pointer; padding:5px 10px; border:1px solid #ddd; background:white; border-radius:5px;">⬅ Back</button>
            <h3 style="color:#1877f2; margin-bottom:15px;">${title}</h3>
        `;

        if (targetList.length === 0) {
            html += `<div class="card" style="padding:30px; text-align:center; color:gray;">
                        <h3>লিস্ট খালি! ☹️</h3>
                     </div>`;
        } else {
            html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">`;

            targetList.forEach(username => {
                // ইউজারের ছবি ও তথ্য বের করা
                const user = allUsers.find(u => u.username === username);
                const pic = user ? (user.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png") : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

                // কার্ড তৈরি (ক্লিক করলে প্রোফাইল ওপেন হবে)
                html += `
                <div class="card" style="text-align:center; padding:15px; cursor:pointer; transition:0.2s;" 
                     onclick="viewUserProfile('${username}')" 
                     onmouseover="this.style.transform='scale(1.03)'" 
                     onmouseout="this.style.transform='scale(1)'">
                    
                    <img src="${pic}" style="width:70px; height:70px; border-radius:50%; object-fit:cover; border:2px solid #1877f2; margin-bottom:10px;">
                    
                    <h4 style="margin:0; font-size:15px;">${username}</h4>
                    <span style="font-size:12px; color:gray;">Click to View Profile</span>
                    
                    <!-- মেসেজ বাটন (অপশনাল, যদি সরাসরি মেসেজ দিতে চান) -->
                    <button onclick="event.stopPropagation(); openChat('${username}')" class="btn-primary" style="width:100%; margin-top:10px; font-size:12px;">
                        Message
                    </button>
                </div>`;
            });

            html += `</div>`;
        }

        contentArea.innerHTML = html;

    } catch (err) {
        console.log(err);
        contentArea.innerHTML = '<p style="color:red; text-align:center;">ডাটা লোড করতে সমস্যা হয়েছে!</p>';
    }
}

// --- চ্যাট ওপেন করার ফাংশন ---
async function openChat(friendName) {
    currentChatFriend = friendName;
    document.getElementById('chat-box').style.display = 'flex';
    document.getElementById('chat-friend-name').innerText = friendName;
    // ডিফল্ট ছবি (চাইলে ডাইনামিক করতে পারেন)
    document.getElementById('chat-friend-img').src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"; 

    const msgBox = document.getElementById('chat-messages');
    msgBox.innerHTML = '<div style="text-align:center; padding:10px;">মেসেজ লোড হচ্ছে...</div>';

    try {
        // ১. পুরনো মেসেজ লোড করা
        const res = await fetch(`/messages/${currentUser}/${friendName}`);
        const messages = await res.json();

        msgBox.innerHTML = ''; // ক্লিয়ার
        messages.forEach(msg => {
        const type = msg.sender === currentUser ? 'my-msg' : 'friend-msg';
        
           appendMessage(msg, type); 
        });
        
        // স্ক্রল নিচে নামানো
        msgBox.scrollTop = msgBox.scrollHeight;
    } catch(err) {
        msgBox.innerHTML = '';
        console.log("মেসেজ লোড সমস্যা:", err);
    }
}

// --- মেসেজ পাঠানো ---
function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value;
    if (!text) return;

    const data = {
        sender: currentUser,
        receiver: currentChatFriend,
        text: text
    };

    // ২. সার্ভারে পাঠানো (Real-time)
    socket.emit('send_message', data);
    
    // নিজের বক্সে সাথে সাথে দেখানো (অপশনাল, তবে ভালো UX এর জন্য)
    // appendMessage(text, 'my-msg'); // socket.on এটা হ্যান্ডেল করছে, তাই ডুপ্লিকেট দরকার নেই
    
    input.value = '';
}

// --- মেসেজ রিসিভ করা (Real-time Listener) ---
socket.on('receive_message', (data) => {
    // যদি আমি চ্যাট বক্সে থাকি এবং মেসেজটি আমার এই চ্যাটের হয়
    if (
        (data.sender === currentChatFriend && data.receiver === currentUser) || 
        (data.sender === currentUser && data.receiver === currentChatFriend)
    ) {
        const type = data.sender === currentUser ? 'my-msg' : 'friend-msg';
        appendMessage(data. type);

        if (data.sender !== currentUser) {
            const audio = new Audio('https://upload.wikimedia.org/wikipedia/commons/e/e9/Ringtone_%283%29.ogg'); 
            audio.play().catch(e => {});
        }
    } else {
        // অন্য কেউ মেসেজ পাঠালে এখানে নোটিফিকেশন সাউন্ড বা অ্যালার্ট দিতে পারেন
        console.log("New message from", data.sender);
    }
});

// --- চ্যাট মেসেজ দেখানো (Image, Video, Audio Fix) ---
function appendMessage(data, className) {
    let text = typeof data === 'string' ? data : (data.text || '');
    let mediaUrl = data.mediaUrl || data.imageUrl || null;
    let mediaType = data.mediaType || 'image';

    if (!text || text === 'undefined') text = '';

    const div = document.createElement('div');
    div.className = className;

    // ১. যদি কোনো মিডিয়া লিংক থাকে
    if (mediaUrl) {
        // ক. ভিডিও ফাইল
        if (mediaType === 'video' || mediaUrl.match(/\.(mp4|webm|mkv)$/i)) {
            div.innerHTML = `
                <video src="${mediaUrl}" controls class="chat-msg-video" style="max-width: 200px; border-radius: 10px; background:black; margin-top:5px;"></video>
            `;
        } 
        // খ. অডিও ফাইল (নতুন যোগ করা হয়েছে)
       else if (mediaType === 'audio' || mediaUrl.match(/\.(mp3|wav|ogg)$/i)) {
            div.innerHTML = `
                <audio controls src="${mediaUrl}"></audio>
            `;
            // অডিওর জন্য আলাদা ব্যাকগ্রাউন্ড বা প্যাডিং দিতে পারেন
            div.style.padding = "5px";
        }
        // গ. ইমেজ ফাইল (ডিফল্ট)
        else {
            div.innerHTML = `
                <img src="${mediaUrl}" class="chat-msg-img" onclick="window.open('${mediaUrl}', '_blank')" 
                     style="max-width: 200px; height:auto; border-radius: 10px; cursor:pointer; margin-top:5px; border:2px solid white;">
            `;
        }
        
        // মিডিয়া বাবল স্টাইল
        div.style.background = "transparent";
        div.style.padding = "0";
        div.style.border = "none";
        div.style.boxShadow = "none";
    } 
    
    // ২. যদি মিডিয়া না থাকে কিন্তু টেক্সট থাকে
    else if (text && text.trim() !== "") {
        // লিংক ডিটেকশন
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        
        if (text.match(urlRegex)) {
            div.innerHTML = text.replace(urlRegex, url => 
                `<a href="${url}" target="_blank" style="color: yellow; text-decoration: underline; font-weight: bold;">
                    <i class="fas fa-link"></i> লিংক খুলুন
                </a>`
            );
        } else {
            div.innerText = text;
        }
        // টেক্সট বাবল স্টাইল (CSS ক্লাস থেকে পাবে)
    }
    
    // ৩. কিছুই না থাকলে
    else {
        return; 
    }

    document.getElementById('chat-messages').appendChild(div);
    
    const box = document.getElementById('chat-messages');
    box.scrollTop = box.scrollHeight;
}
function closeChat() {
    document.getElementById('chat-box').style.display = 'none';
    currentChatFriend = null;
}

// --- মেসেঞ্জার টগল এবং লিস্ট লোড ফাংশন ---

async function toggleMessenger() {
    const box = document.getElementById('messenger-dropdown');
    const listBody = document.getElementById('messenger-list-body');

    // ১. যদি বক্স খোলা থাকে, তবে বন্ধ করো
    if (box.style.display === 'block') {
        box.style.display = 'none';
        return;
    }

    // ২. বক্স ওপেন করো
    box.style.display = 'block';
    
    // ৩. নোটিফিকেশন বক্স খোলা থাকলে বন্ধ করে দাও (যাতে ওভারল্যাপ না হয়)
    document.getElementById('notification-box').style.display = 'none';

    // ৪. বন্ধুদের লিস্ট লোড করা
    try {
        const res = await fetch('/users'); // আপাতত সব ইউজার লোড করছি
        const users = await res.json();
        
        listBody.innerHTML = ''; // আগের লিস্ট ক্লিয়ার

        // নিজেকে বাদ দিয়ে বাকিদের লিস্ট বানানো
        const friends = users.filter(u => u.username !== currentUser);

        if (friends.length === 0) {
            listBody.innerHTML = '<p style="text-align:center; padding:20px;">কোনো বন্ধু নেই</p>';
            return;
        }

        friends.forEach(user => {
            const pic = user.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
            
            const div = document.createElement('div');
            div.className = 'chat-list-item';
            div.onclick = function() {
                openChat(user.username); // চ্যাট বক্স ওপেন হবে
                box.style.display = 'none'; // লিস্ট বন্ধ হয়ে যাবে
            };

            div.innerHTML = `
                <img src="${pic}">
                <div class="chat-list-name">${user.username}</div>
            `;
            listBody.appendChild(div);
        });

    } catch (err) {
        console.log(err);
        listBody.innerHTML = '<p style="text-align:center; color:red;">লোড করতে সমস্যা!</p>';
    }
}


// --- নতুন: ব্যালেন্স আপডেট করার ছোট ফাংশন ---
async function updateMyBalanceUI() {
    try {
        const res = await fetch(`/my-balance/${currentUser}`);
        const data = await res.json();
        const balanceSpan = document.getElementById('user-coin-balance');
        if(balanceSpan) {
            balanceSpan.innerText = data.coins;
        }
    } catch(e) {}
}

// --- কমেন্টে লাইক দেওয়া (DOM Update Fix) ---
async function likeComment(postId, commentId) {
    try {
        const res = await fetch(`/like-comment/${postId}/${commentId}`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            // নির্দিষ্ট আইডি ধরে স্প্যান খোঁজা
            const likeSpan = document.getElementById(`like-span-${commentId}`);
            
            if(likeSpan) {
                // 👇 সার্ভার থেকে আসা সঠিক সংখ্যাটি বসানো হচ্ছে
                likeSpan.innerText = `Love (${data.likes})`;
                
                // নীল কালার করে দেওয়া (বোঝার জন্য যে লাইক হয়েছে)
                likeSpan.style.color = '#1877f2';
                likeSpan.style.fontWeight = 'bold';
            }
        }
    } catch (err) {
        console.log("লাইক সমস্যা:", err);
    }
}

// --- ২. রিপ্লাই বক্স খোলা/বন্ধ করা ---
function toggleReplyBox(commentId) {
    const box = document.getElementById(`reply-box-${commentId}`);
    if (box.style.display === 'none') {
        box.style.display = 'block';
        // ইনপুটে ফোকাস করা
        const input = document.getElementById(`reply-input-${commentId}`);
        if(input) input.focus();
    } else {
        box.style.display = 'none';
    }
}

// --- রিপ্লাই সাবমিট করা (No Reload) ---
async function submitReply(postId, commentId) {
    const input = document.getElementById(`reply-input-${commentId}`);
    const text = input.value;
    
    if (!text) return alert("কিছু লিখুন!");

    try {
        const res = await fetch(`/reply-comment/${postId}/${commentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser, text: text })
        });

        const data = await res.json();
        
        if (data.success) {
            // 👇 পেজ রিফ্রেশ না করে নতুন রিপ্লাই যোগ করা
            const repliesHolder = document.getElementById(`replies-holder-${commentId}`);
            
            // রিপ্লাইকারীর ছবি (লোকাল স্টোরেজ থেকে বা ডিফল্ট)
            const myPic = localStorage.getItem('profilePic') || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

            const newReplyHTML = `
                <div style="margin-top:5px; margin-left:30px; font-size:13px; display:flex; gap:5px; animation: fadeIn 0.5s;">
                    <img src="${myPic}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                    <div style="background:#e4e6eb; padding:5px 10px; border-radius:10px;">
                        <b>${currentUser}</b> ${text}
                    </div>
                </div>`;
            
            if(repliesHolder) {
                repliesHolder.insertAdjacentHTML('beforeend', newReplyHTML);
            }

            // ইনপুট বক্স খালি এবং বন্ধ করা
            input.value = '';
            document.getElementById(`reply-box-${commentId}`).style.display = 'none';

        } else {
            alert("রিপ্লাই দেওয়া যায়নি!");
        }
    } catch (err) {
        console.log("রিপ্লাই সমস্যা:", err);
    }
}

// --- নাম দিয়ে সার্চ করার ফিল্টার ফাংশন ---
function filterFriendsUI() {
    const input = document.getElementById('friendSearch').value.toLowerCase();
    const container = document.getElementById('friends-content-area');
    const cards = container.getElementsByClassName('user-card-item');

    let hasResult = false;

    for (let i = 0; i < cards.length; i++) {
        const nameElement = cards[i].getElementsByClassName('user-name-text')[0];
        
        if (nameElement) {
            const nameValue = nameElement.innerText || nameElement.textContent;

            // নামের সাথে মিললে দেখাবে, না মিললে লুকাবে
            if (nameValue.toLowerCase().indexOf(input) > -1) {
                cards[i].style.display = ""; // শো
                hasResult = true;
            } else {
                cards[i].style.display = "none"; // হাইড
            }
        }
    }

    // যদি সার্চের পর কাউকে না পাওয়া যায়
    // (আগের কোনো "No result" মেসেজ থাকলে মুছে ফেলা)
    const oldMsg = document.getElementById('no-search-result');
    if (oldMsg) oldMsg.remove();

    if (!hasResult && input !== "") {
        const msg = document.createElement('p');
        msg.id = 'no-search-result';
        msg.style.textAlign = 'center';
        msg.style.color = 'gray';
        msg.style.gridColumn = '1 / -1';
        msg.innerText = 'কাউকে পাওয়া যায়নি 🔍';
        
        // গ্রিড কন্টেইনারে মেসেজ যোগ করা
        const grid = document.querySelector('.user-card-item-container');
        if(grid) grid.appendChild(msg);
    }
}

// --- ফোন নম্বর দিয়ে কানেক্ট ফাংশন ---
async function connectByPhone() {
    const inputField = document.getElementById('phoneInput');
    const mobile = inputField.value;
    
    if (!mobile) return alert("দয়া করে একটি নম্বর দিন!");

    try {
        // লোডিং বোঝাতে বাটনের টেক্সট বদলানো
        const btn = inputField.nextElementSibling; // Add বাটন
        const originalText = btn.innerText;
        btn.innerText = "Checking...";
        btn.disabled = true;

        const res = await fetch('/connect-by-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: currentUser, mobile: mobile })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            inputField.value = ''; // বক্স খালি করা
            
            // 👇 লিস্ট রিফ্রেশ করা (যাতে যাকে কানেক্ট করলেন সে Following এ চলে যায়)
            showFriendsView(); 
        } else {
            alert("ত্রুটি: " + data.message);
        }

        // বাটন আগের অবস্থায় আনা
        btn.innerText = originalText;
        btn.disabled = false;

    } catch (err) {
        alert("সার্ভার সমস্যা");
    }
}

// --- এডিট প্রোফাইল মোডাল ওপেন করা ---
async function openEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    
    // বর্তমান ডাটা প্রিভিউতে দেখানো
    try {
        const res = await fetch('/users');
        const allUsers = await res.json();
        const me = allUsers.find(u => u.username === currentUser);

        document.getElementById('preview-profile-pic').src = me.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
        
        // কভার ফটো প্রিভিউ
        const coverPreview = document.getElementById('preview-cover-pic');
        if(me.coverPic) {
            coverPreview.src = me.coverPic;
            coverPreview.style.display = 'block';
        } else {
            coverPreview.style.display = 'none'; // কভার না থাকলে হাইড
        }

        document.getElementById('editBioInput').value = me.bio || "";
        
        modal.style.display = 'flex';
    } catch(err) {
        alert("ডাটা লোড সমস্যা");
    }
}

// --- প্রোফাইল সেভ ফাংশন (আপডেট করা) ---
async function saveProfileChanges() {
    const profileInput = document.getElementById('editProfileInput').files[0];
    const coverInput = document.getElementById('editCoverInput').files[0];
    const bioText = document.getElementById('editBioInput').value;

    const formData = new FormData();
    formData.append('username', currentUser);
    formData.append('bio', bioText); // বায়ো পাঠানো হচ্ছে

    // ছবি থাকলে অ্যাপেন্ড করা হবে
    if (profileInput) {
        formData.append('profilePic', profileInput);
    }
    if (coverInput) {
        formData.append('coverPic', coverInput);
    }

    // বাটন লোডিং করা
    const btn = document.querySelector('#edit-profile-modal .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        const res = await fetch('/update-profile-data', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            alert("সফলভাবে আপডেট হয়েছে!");
            
            // লোকাল স্টোরেজে নতুন ছবি রাখা (অপশনাল)
            if(data.profilePic) localStorage.setItem('profilePic', data.profilePic);
            
            // মোডাল বন্ধ করে প্রোফাইল রিফ্রেশ
            document.getElementById('edit-profile-modal').style.display = 'none';
            showMyProfile(); 
        } else {
            alert("আপডেট ব্যর্থ: " + (data.error || "অজানা সমস্যা"));
        }
    } catch (err) {
        console.log(err);
        alert("সার্ভারে সমস্যা হয়েছে");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// --- চ্যাট লিস্ট সার্চ/ফিল্টার ফাংশন ---
function filterChatList() {
    // ১. ইনপুট ভ্যালু নেওয়া
    const input = document.getElementById('chatSearchInput').value.toLowerCase();
    
    // ২. লিস্ট এবং আইটেমগুলো ধরা
    const listBody = document.getElementById('messenger-list-body');
    const items = listBody.getElementsByClassName('chat-list-item');

    // ৩. লুপ চালিয়ে চেক করা
    for (let i = 0; i < items.length; i++) {
        const nameElement = items[i].getElementsByClassName('chat-list-name')[0];
        
        if (nameElement) {
            const nameValue = nameElement.innerText || nameElement.textContent;

            // নামের সাথে মিললে দেখাবে (flex), না মিললে লুকাবে (none)
            if (nameValue.toLowerCase().indexOf(input) > -1) {
                items[i].style.display = "flex";
            } else {
                items[i].style.display = "none";
            }
        }
    }
}

//new
// গ্লোবাল ভেরিয়েবল (সব শর্টস মনে রাখার জন্য)
let allShortsData = [];

// ১. টপ শর্টস লোড করার ফাংশন (এটি showApp বা loadPosts এর সাথে কল করবেন)
async function loadTopShorts() {
    const container = document.getElementById('top-shorts-bar');
    
    try {
        // সব পোস্ট এবং ইউজার আনা
        const [postRes, userRes] = await Promise.all([fetch('/posts'), fetch('/users')]);
        const posts = await postRes.json();
        const users = await userRes.json();

        // শুধু শর্টস ফিল্টার করা
        allShortsData = posts.filter(p => p.isShort === true);

        if (allShortsData.length === 0) {
            container.innerHTML = '<div class="card" style="padding:10px; min-width:200px;">কোনো শর্টস নেই</div>';
            return;
        }

        let html = '';
        
        // আপলোড বাটন (নিজের শর্ট আপলোড করার জন্য) - ফেসবুকের মতো
        html += `
        <div class="story-card" onclick="openTikTokCreator()" style="background:white; border:1px solid #ddd;">
        <div style="height:70%; background:#f0f2f5; display:flex; justify-content:center; align-items:center;">
        <i class="fas fa-plus" style="font-size:30px; color:#1877f2;"></i>
        </div>
        <div style="padding:5px; text-align:center; font-weight:bold; font-size:12px;">Create Short</div>
        </div>`;

        // শর্টস কার্ড বানানো
        allShortsData.forEach((short, index) => {
            // মালিকের ছবি বের করা
            const owner = users.find(u => u.username === short.username);
            const ownerPic = owner ? (owner.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png") : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

            html += `
            <div class="story-card" onclick="openFullShorts('${short._id}')">
                <video src="${short.mediaUrl}#t=0.1" class="story-video-thumb" preload="metadata"></video>
                <img src="${ownerPic}" class="story-profile">
                <span class="story-username">${short.username}</span>
            </div>`;
        });

        container.innerHTML = html;

    } catch (err) {
        console.log(err);
    }
}


// --- টপ শর্টস বার ড্র্যাগ (Drag to Scroll) ফিচার ---
const slider = document.getElementById('top-shorts-bar');
let isDown = false;
let startX;
let scrollLeft;

if(slider) {
    // ১. মাউস ক্লিক করলে
    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('active'); // গ্র্যাবিং কার্সর
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    // ২. মাউস ছেড়ে দিলে বা বাইরে গেলে
    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.classList.remove('active');
    });

    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.classList.remove('active');
    });

    // ৩. মাউস মুভ করলে (আসল কাজ এখানে)
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return; // ক্লিক না করা থাকলে কাজ করবে না
        e.preventDefault();  // টেক্সট সিলেক্ট বন্ধ করা
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // স্কলের স্পিড (2x)
        slider.scrollLeft = scrollLeft - walk;
    });
}

// --- ১. লিংক চেক করার ফাংশন ---
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false; 
    }
}

// --- ২. ইউটিউব লিংক থেকে ভিডিও ID বের করার ফাংশন ---
function getYoutubeID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
// ================= শর্টস কমেন্ট সিস্টেম (আপডেটেড) =================

// ১. কমেন্ট বক্স ওপেন করা এবং লিস্ট দেখানো
async function openShortsComments(postId) {
    const modal = document.getElementById('shorts-comment-modal');
    const list = document.getElementById('shorts-comments-list');
    const btn = document.getElementById('shortsCommentBtn');
    
    modal.style.display = 'flex';
    // প্রথমবার খোলার সময় শুধু লোডিং দেখাবে, রিফ্রেশে দেখাবে না
    if(list.innerHTML === '') list.innerHTML = '<div style="text-align:center; padding:20px;">🔄 লোডিং...</div>';

    // নতুন কমেন্ট পোস্ট করার বাটন সেটআপ
    btn.onclick = function() { postShortComment(postId); };

    try {
        // ডাটা আনা
        const [postRes, userRes] = await Promise.all([ fetch('/posts'), fetch('/users') ]);
        const posts = await postRes.json();
        const allUsers = await userRes.json();
        
        const post = posts.find(p => p._id === postId);

        list.innerHTML = ''; // ক্লিয়ার
        
        if (!post.comments || post.comments.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:gray; margin-top:50px;">কোনো কমেন্ট নেই।<br>প্রথম কমেন্টটি আপনি করুন! 😊</div>';
        } else {
            post.comments.forEach(c => {
                // ইউজারের ছবি
                const commenter = allUsers.find(u => u.username === c.user);
                const pic = commenter ? (commenter.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png") : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

                // রিপ্লাই HTML তৈরি
                let repliesHtml = '';
                if(c.replies && c.replies.length > 0) {
                    c.replies.forEach(r => {
                        const rUser = allUsers.find(u => u.username === r.user);
                        const rPic = rUser ? rUser.profilePic : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
                        repliesHtml += `
                            <div style="display:flex; gap:5px; margin-top:5px; font-size:12px;">
                                <img src="${rPic}" style="width:20px; height:20px; border-radius:50%;">
                                <div style="background:#e4e6eb; padding:5px 8px; border-radius:10px;">
                                    <b>${r.user}</b> ${r.text}
                                </div>
                            </div>`;
                    });
                }

                // মেইন কমেন্ট HTML
                const div = document.createElement('div');
                div.className = 'short-comment-wrapper';
                div.innerHTML = `
                    <img src="${pic}" class="short-comment-avatar">
                    <div class="short-comment-content">
                        <div class="short-bubble">
                            <b style="display:block;">${c.user}</b>
                            ${c.text}
                        </div>
                        
                        <!-- অ্যাকশন বাটন -->
                        <div class="short-actions">
                            <span class="short-action-btn" onclick="likeShortComment('${postId}', '${c._id}')">
                                ❤️ ${c.likes || 0}
                            </span>
                            <span class="short-action-btn" onclick="document.getElementById('short-reply-box-${c._id}').style.display = 'flex'">
                                Reply
                            </span>
                        </div>

                        <!-- রিপ্লাই লিস্ট -->
                        <div class="short-reply-list">${repliesHtml}</div>

                        <!-- রিপ্লাই ইনপুট (লুকানো) -->
                        <div id="short-reply-box-${c._id}" style="display:none; gap:5px; margin-top:5px;">
                            <input type="text" id="short-reply-input-${c._id}" placeholder="Reply..." style="font-size:12px; padding:5px; border:1px solid #ddd; border-radius:10px; width:100%;">
                            <button onclick="replyShortComment('${postId}', '${c._id}')" style="font-size:10px; cursor:pointer;">Send</button>
                        </div>
                    </div>
                `;
                list.appendChild(div);
            });
        }
    } catch (err) { console.log(err); }
}

// ২. মেইন কমেন্ট পোস্ট করা
async function postShortComment(postId) {
    const input = document.getElementById('shortsCommentInput');
    const text = input.value;
    if (!text) return;

    await fetch(`/comment/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser, text: text })
    });

    input.value = '';
    openShortsComments(postId); // লিস্ট রিফ্রেশ (ভিডিও রিলোড হবে না)
}

// ৩. শর্টস কমেন্টে লাইক দেওয়া
async function likeShortComment(postId, commentId) {
    await fetch(`/like-comment/${postId}/${commentId}`, { method: 'POST' });
    openShortsComments(postId); // শুধু কমেন্ট লিস্ট রিফ্রেশ হবে
}

// ৪. শর্টস কমেন্টে রিপ্লাই দেওয়া
async function replyShortComment(postId, commentId) {
    const input = document.getElementById(`short-reply-input-${commentId}`);
    const text = input.value;
    if(!text) return;

    await fetch(`/reply-comment/${postId}/${commentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser, text: text })
    });

    openShortsComments(postId); // লিস্ট রিফ্রেশ
}

// --- ৩. বক্স বন্ধ করা ---
function closeShortsComments() {
    document.getElementById('shorts-comment-modal').style.display = 'none';
}

// --- শর্টস প্লে/পজ কন্ট্রোল ---
function toggleShortsPlay() {
    const video = document.getElementById('full-short-video');
    const icon = document.getElementById('play-pause-icon');

    if (video.paused) {
        video.play();
        icon.style.display = 'none'; // প্লে হলে আইকন গায়েব
        icon.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        video.pause();
        icon.style.display = 'block'; // পজ হলে আইকন আসবে
        icon.innerHTML = '<i class="fas fa-play"></i>';
    }
}

// --- সময় ফরম্যাট (মিনিট:সেকেন্ড) ---
function formatTime(seconds) {
    if(isNaN(seconds)) return "00:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec}`;
}

// --- ভিডিও টেনে দেখা (Seek Fix) ---
function seekVideo() {
    const video = document.getElementById('full-short-video');
    const progressBar = document.getElementById('shorts-progress-bar');
    
    // ভিডিওর দৈর্ঘ্য ঠিক থাকলে কাজ করবে
    if (video && video.duration) {
        const seekTime = (progressBar.value / 100) * video.duration;
        video.currentTime = seekTime;
    }
}

//10--- চ্যাট এটাচমেন্ট লজিক ---

// ১. মেনু টগল (Open/Close)
function toggleChatAttach() {
    const menu = document.getElementById('chat-attachment-menu');
    if (menu.style.display === 'none') {
        menu.style.display = 'flex';
    } else {
        menu.style.display = 'none';
    }
}

// --- লোকেশন পাঠানোর ফাংশন ---
function sendChatLocation() {
    if (!navigator.geolocation) {
        return alert("আপনার ব্রাউজারে লোকেশন সাপোর্ট নেই।");
    }

    // মেনু বন্ধ করা
    document.getElementById('chat-attachment-menu').style.display = 'none';

    navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // গুগল ম্যাপস লিংক
        const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
        
        // মেসেজ পাঠানো
        const data = {
            sender: currentUser,
            receiver: currentChatFriend,
            text: `📍 আমার লোকেশন: ${mapLink}` // এই লিংকটি এখন ক্লিকেবল হবে
        };
        
        socket.emit('send_message', data);
        
        // নিজের চ্যাট বক্সে দেখানো (সরাসরি লিংক হিসেবে যাবে)
        appendMessage(`📍 আমার লোকেশন: ${mapLink}`, 'my-msg');

    }, () => {
        alert("লোকেশন এক্সেস পাওয়া যায়নি! (GPS অন করুন)");
    });
}

// ৩. ফাইল বা ক্যামেরা সিলেক্ট করলে (আপাতত ফাইলের নাম মেসেজ বক্সে দেখাবে)
function handleChatFileUpload() {
    const fileInput = document.getElementById('chatFileInput');
    const file = fileInput.files[0];
    
    if (file) {
        document.getElementById('chat-attachment-menu').style.display = 'none';
        
        // ফাইলটি সার্ভারে আপলোড করে লিংক পাঠানোর কাজটা জটিল (Multer লাগে)
        // তাই আপাতত আমরা শুধু ফাইলের নামটা টেক্সট বক্সে দেখাচ্ছি
        const msgInput = document.getElementById('msgInput');
        msgInput.value = `[File Selected: ${file.name}] - (Image sending coming soon)`;
        msgInput.focus();
    }
}
//10

// --- চ্যাটে ফাইল আপলোড এবং সেন্ড ফাংশন (ফিক্সড) ---
async function handleChatFileUpload(type) {
    let fileInput;

    // কোন ইনপুট থেকে ফাইল আসছে তা ধরা
    if (type === 'photo') {
        fileInput = document.getElementById('chatPhotoInput');
    } else if (type === 'video') {
        fileInput = document.getElementById('chatVideoInput');
    } else {
        // যদি type না পাঠানো হয় (ক্যামেরা বা সাধারণ ফাইল)
        fileInput = document.getElementById('chatFileInput');
    }

    // ফাইল আছে কিনা চেক
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        return console.log("কোনো ফাইল সিলেক্ট করা হয়নি");
    }

    const file = fileInput.files[0];

    // মেনু বন্ধ করা
    const menu = document.getElementById('chat-attachment-menu');
    if(menu) menu.style.display = 'none';

    // লোডিং দেখানো (অপশনাল)
    // alert("আপলোড হচ্ছে...");

    const formData = new FormData();
    formData.append('chatFile', file); // সার্ভারে নাম 'chatFile'

    try {
        const res = await fetch('/chat-upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            console.log("File Uploaded:", data.mediaUrl); // কনসোলে লিংক দেখাবে

            const msgData = {
                sender: currentUser,
                receiver: currentChatFriend,
                text: '', // টেক্সট খালি
                mediaUrl: data.mediaUrl, // সার্ভার থেকে পাওয়া লিংক
                mediaType: data.mediaType
            };
            
            // ১. সকেটে পাঠানো
            socket.emit('send_message', msgData);

            // ২. নিজের বক্সে দেখানো (সরাসরি appendMessage কল)
            appendMessage(msgData, 'my-msg');
            
            // ৩. ইনপুট রিসেট
            fileInput.value = "";
            
        } else {
            alert("আপলোড ব্যর্থ: " + data.error);
        }
    } catch (err) {
        console.log(err);
        alert("সার্ভার এরর!");
    }
}
// --- লগআউট ফাংশন ---
function logout() {
    // ১. ব্রাউজারের মেমোরি ক্লিয়ার করা
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('profilePic');
    
    // অথবা সব একসাথে ডিলিট করতে চাইলে:
    // localStorage.clear();

    // ২. পেজ রিলোড করা (এতে অটোমেটিক লগিন পেজে চলে যাবে)
    location.reload();
}

// --- লগিন এবং রেজিস্টার ফর্ম অদল-বদল করার ফাংশন ---
function toggleAuth() {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const otpSection = document.getElementById('otp-section');

    // যদি লগিন ফর্ম লুকানো থাকে, তবে সেটি দেখাবে
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
    } 
    // নাহলে রেজিস্টার ফর্ম দেখাবে
    else {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
    }

    // OTP সেকশনটি লুকিয়ে ফেলা (যদি খোলা থাকে)
    if(otpSection) otpSection.style.display = 'none';
}

// --- ১. লাইভ কয়েন ব্যালেন্স লোড করা ---
async function updateNavBalance() {
    try {
        const res = await fetch(`/my-balance/${currentUser}`);
        const data = await res.json();
        
        const navBalance = document.getElementById('nav-coin-balance');
        const menuBalance = document.getElementById('user-coin-balance');

        // সব জায়গায় ব্যালেন্স আপডেট
        if(navBalance) navBalance.innerText = data.coins;
        if(menuBalance) menuBalance.innerText = data.coins;
        
    } catch(e) {}
}

// অ্যাপ চালু হলে ব্যালেন্স লোড হবে
// (showApp ফাংশনের ভেতরে updateNavBalance() কল করে দিতে পারেন)

// --- ২. উড়ন্ত কয়েন এনিমেশন ---
function animateCoinFly(startElem) {
    const targetElem = document.querySelector('.coin-display-box'); // গন্তব্য (উপরের বক্স)
    
    if(!startElem || !targetElem) return;

    // ১. শুরুর এবং শেষের অবস্থান বের করা
    const startRect = startElem.getBoundingClientRect();
    const targetRect = targetElem.getBoundingClientRect();

    // ২. একটি ডামি কয়েন তৈরি করা
    const coin = document.createElement('i');
    coin.className = 'fas fa-coins flying-coin-anim';
    
    // শুরুর পজিশনে বসানো
    coin.style.left = `${startRect.left + 10}px`;
    coin.style.top = `${startRect.top}px`;
    
    document.body.appendChild(coin);

    // ৩. একটু পর উড়ে যাবে
    setTimeout(() => {
        coin.style.left = `${targetRect.left + 10}px`;
        coin.style.top = `${targetRect.top + 10}px`;
        coin.style.opacity = '0.5';
        coin.style.transform = 'scale(0.5)';
    }, 50);

    // ৪. পৌঁছানোর পর মুছে ফেলা এবং ব্যালেন্স আপডেট
    setTimeout(() => {
        coin.remove();
        
        // বক্সে পালস ইফেক্ট দেওয়া
        targetElem.classList.add('coin-pulse');
        setTimeout(() => targetElem.classList.remove('coin-pulse'), 500);

        // ব্যালেন্স আপডেট
        updateNavBalance(); 

    }, 850); // 0.8s এনিমেশন টাইম + বাফার
}


// --- কয়েন দেওয়ার ফাংশন (ফিক্সড ও আপডেটেড) ---
async function giveCoin(id) {
    try {
        const res = await fetch(`/give-coin/${id}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser }) 
        });
        
        const data = await res.json();

        if(res.ok) {
            // ১. সাউন্ড ইফেক্ট
            const audio = new Audio('https://upload.wikimedia.org/wikipedia/commons/2/29/Chime-bell-ding.wav');
            audio.play().catch(e => {});

            // ================= বাটন আপডেট লজিক =================

            // ক. হোম পেজের বাটন (যদি স্ক্রিনে থাকে)
            const homeBtn = document.getElementById(`coin-btn-${id}`);
            const coinValSpan = document.getElementById(`coin-val-${id}`);
            const coinTextSpan = document.getElementById(`coin-txt-${id}`);

            if (homeBtn) {
                // এনিমেশন কল করা
                if(typeof animateCoinFly === 'function') animateCoinFly(homeBtn);
                
                // বাটন গোল্ডেন করা এবং ডিজেবল করা
                homeBtn.style.color = '#fbc02d';
                homeBtn.onclick = null;

                // সংখ্যা বাড়ানো
                if(coinValSpan) {
                    let currentCount = parseInt(coinValSpan.innerText) || 0;
                    coinValSpan.innerText = currentCount + 1;
                }
                
                // 👇 "Get 1" লেখাটি মুছে ফেলা
                if(coinTextSpan) {
                    coinTextSpan.remove();
                }
            }

            // খ. শর্টস গ্রিড বাটন (যদি স্ক্রিনে থাকে)
            const shortBtn = document.getElementById(`short-coin-btn-${id}`);
            const shortCount = document.getElementById(`short-coin-count-${id}`);
            
            if (shortBtn) {
                if(typeof animateCoinFly === 'function') animateCoinFly(shortBtn);
                shortBtn.style.color = '#fbc02d';
                shortBtn.onclick = null;
            }
            if (shortCount) {
                let current = parseInt(shortCount.innerText) || 0;
                shortCount.innerText = current + 1;
            }

            // গ. ফুল স্ক্রিন মোডাল বাটন (যদি ভিডিওটি ওপেন থাকে)
            const fullScreenBtnDiv = document.querySelector('#full-short-like-btn div');
            const fullScreenCountSpan = document.querySelector('#full-short-like-btn span');
            
            // ফুল স্ক্রিন আপডেট হবে যদি মোডাল খোলা থাকে
            const modal = document.getElementById('full-shorts-modal');
            if (modal && modal.style.display === 'block' && fullScreenBtnDiv && fullScreenCountSpan) {
                
                if(typeof animateCoinFly === 'function') animateCoinFly(fullScreenBtnDiv);

                fullScreenBtnDiv.style.color = '#fbc02d';
                fullScreenBtnDiv.onclick = null; // ডিজেবল
                
                let current = parseInt(fullScreenCountSpan.innerText) || 0;
                fullScreenCountSpan.innerText = current + 1;
            }

            // =================================================

            // ২. ব্যালেন্স আপডেট (উপরের বক্সে)
            if (typeof updateNavBalance === 'function') {
                updateNavBalance();
            } else if (typeof updateMyBalanceUI === 'function') {
                updateMyBalanceUI();
            }

        } else {
            alert(data.error); // "ইতিমধ্যে কয়েন দিয়েছেন" মেসেজ
        }
    } catch (err) {
        console.log(err);
    }
}
// --- ৪. রিয়েল-টাইম রিসিভ আপডেট (Socket) ---
// কেউ আপনাকে কয়েন দিলে সাথে সাথে ব্যালেন্স বাড়বে
socket.on('new_notification', (data) => {
    // যদি নোটিফিকেশনটি আমার জন্য হয় এবং টাইপ 'coin' হয়
    if (data.receiver === currentUser && data.type === 'coin') {
        updateNavBalance(); // ব্যালেন্স +5 হয়ে যাবে
        
        // ছোট্ট একটি নোটিফিকেশন সাউন্ড
        const audio = new Audio('https://upload.wikimedia.org/wikipedia/commons/6/6c/Gnome-face-cool.wav');
        audio.play().catch(e=>{});
    }
});

// ================= সেটিংস ফাংশনালিটি =================

// ১. সেটিংস মোডাল ওপেন
function openSettingsModal() {
    // ড্রপডাউন বন্ধ করা
    document.getElementById('settings-dropdown').style.display = 'none';
    // মোডাল খোলা
    document.getElementById('settings-modal').style.display = 'flex';
    
    // ডার্ক মোড চেক করা
    const isDark = localStorage.getItem('theme') === 'dark';
    document.getElementById('darkModeToggle').checked = isDark;
}

// ২. সেকশন টগল (পাসওয়ার্ড ফর্ম দেখানো)
function toggleSettingSection(id) {
    const section = document.getElementById(id);
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
}

// ৩. ডার্ক মোড টগল
function toggleDarkMode() {
    const isChecked = document.getElementById('darkModeToggle').checked;
    if (isChecked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
    }
}

// পেজ লোড হলে থিম চেক করা (এটি showApp এর শুরুতে কল করতে পারেন)
if(localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

// ৪. পাসওয়ার্ড পরিবর্তন
async function changePassword() {
    const oldPass = document.getElementById('oldPass').value;
    const newPass = document.getElementById('newPass').value;

    if(!oldPass || !newPass) return alert("সব তথ্য দিন!");

    try {
        const res = await fetch('/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, oldPass, newPass })
        });
        const data = await res.json();
        alert(data.message);
        
        if(data.success) {
            document.getElementById('pass-section').style.display = 'none';
            document.getElementById('oldPass').value = '';
            document.getElementById('newPass').value = '';
        }
    } catch(err) { alert("সার্ভার এরর"); }
}

// ৫. একাউন্ট ডিলিট
async function deleteMyAccount() {
    if(!confirm("সতর্কতা: আপনি কি নিশ্চিত আপনার একাউন্ট ডিলিট করতে চান? এটি আর ফেরত পাওয়া যাবে না!")) return;
    
    const pass = prompt("নিশ্চিত করতে আপনার পাসওয়ার্ড লিখুন:"); // সাধারণ ভেরিফিকেশন (অপশনাল)
    if(!pass) return;

    // পাসওয়ার্ড ভেরিফাই করার জন্য আমরা এখানে সিম্পল লগিন API কল করতে পারি, 
    // কিন্তু আপাতত সরাসরি ডিলিট রিকোয়েস্ট পাঠাচ্ছি।
    
    try {
        const res = await fetch('/delete-my-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
        });
        const data = await res.json();
        
        if(data.success) {
            alert(data.message);
            logout(); // লগআউট করে বের করে দেওয়া
        } else {
            alert("ডিলিট করা যায়নি!");
        }
    } catch(err) { alert("সার্ভার এরর"); }
}

// ================= ভাষা পরিবর্তন সিস্টেম (সম্পূর্ণ) =================

// ১. ভাষার শব্দভাণ্ডার (Dictionary)
const translations = {
    en: {
        search_placeholder: "Search video, music or people...",
        input_placeholder: "What's on your mind?",
        
        // মেনু টেক্সট
        settings_title: "Settings & Privacy",
        help_text: "Help & Support",
        dark_mode: "Display (Dark Mode)",
        lang_text: "Language",
        logout_text: "Log Out",
        
        // বাটন টেক্সট
        post_btn: "Post",
        live_btn: "Live",
        photo_btn: "Photo/Video"
    },
    bn: {
        search_placeholder: "ভিডিও, গান বা মানুষ খুঁজুন...",
        input_placeholder: "আজকের খবর কি?",
        
        // মেনু টেক্সট
        settings_title: "সেটিংস এবং প্রাইভেসি",
        help_text: "সাহায্য এবং সাপোর্ট",
        dark_mode: "ডার্ক মোড",
        lang_text: "ভাষা (Language)",
        logout_text: "লগ আউট",
        
        // বাটন টেক্সট
        post_btn: "পোস্ট করুন",
        live_btn: "লাইভ",
        photo_btn: "ছবি/ভিডিও"
    }
};

// ২. ভাষা পরিবর্তন করার ফাংশন
function changeLanguage(langCode) {
    // লোকাল স্টোরেজে ভাষা সেভ করা
    localStorage.setItem('selectedLang', langCode);
    
    // টেক্সট আপডেট করা
    updateAppText(langCode);
    
    // মেনু বন্ধ করা
    document.getElementById('settings-dropdown').style.display = 'none';
}

// ৩. টেক্সট আপডেট করার মেইন ফাংশন
function updateAppText(langCode) {
    const data = translations[langCode] || translations['en'];

    // --- ইনপুট প্লেসহোল্ডার চেঞ্জ ---
    const searchInput = document.getElementById('searchInput');
    if(searchInput) searchInput.placeholder = data.search_placeholder;

    // পোস্ট বক্সের প্লেসহোল্ডার (হোম এবং মোডাল দুই জায়গাতেই)
    const homeInput = document.querySelector('.post-input-area input');
    if(homeInput) homeInput.placeholder = data.input_placeholder;
    
    const modalInput = document.getElementById('postCaption');
    if(modalInput) modalInput.placeholder = data.input_placeholder;

    // --- মেনু টেক্সট চেঞ্জ (ID দিয়ে) ---
    if(document.getElementById('txt_settings')) 
        document.getElementById('txt_settings').innerText = data.settings_title;
    
    if(document.getElementById('txt_help')) 
        document.getElementById('txt_help').innerText = data.help_text;
    
    if(document.getElementById('txt_dark')) 
        document.getElementById('txt_dark').innerText = data.dark_mode;
    
    if(document.getElementById('txt_lang')) 
        document.getElementById('txt_lang').innerText = data.lang_text;
    
    if(document.getElementById('txt_logout')) 
        document.getElementById('txt_logout').innerText = data.logout_text;
}

// ৪. পেজ লোড হলে ভাষা সেট করা
window.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('selectedLang') || 'en';
    updateAppText(savedLang);
});

// --- ১. ভিডিও ৫ সেকেন্ড আগানো/পিছানো ---
function skipVideo(seconds) {
    const video = document.getElementById('full-short-video');
    if (video) {
        video.currentTime += seconds;
    }
}

// --- ওয়াচ রিওয়ার্ড ফাংশন (Shorts দেখলেই কয়েন) ---
async function claimWatchReward(postId) {
    try {
        const res = await fetch(`/watch-short/${postId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
        });
        
        const data = await res.json();

        // যদি সফলভাবে কয়েন পায়
        if (data.success) {
            // ১. সাউন্ড (কয়েন পাওয়ার শব্দ)
            const audio = new Audio('https://upload.wikimedia.org/wikipedia/commons/2/29/Chime-bell-ding.wav');
            audio.play().catch(e => {});

            // ২. স্ক্রিনে একটি ছোট নোটিফিকেশন (Toast) দেখানো
            showCoinToast("+1 Coin Earned! 🪙");

            // ৩. ব্যালেন্স আপডেট
            if(typeof updateNavBalance === 'function') updateNavBalance();
        }
    } catch (err) {
        console.log(err);
    }
}

// সুন্দর টোস্ট মেসেজ দেখানোর ফাংশন
function showCoinToast(msg) {
    const div = document.createElement('div');
    div.innerText = msg;
    div.style.position = 'fixed';
    div.style.top = '20%';
    div.style.left = '50%';
    div.style.transform = 'translate(-50%, -50%)';
    div.style.background = 'rgba(255, 215, 0, 0.9)';
    div.style.color = 'black';
    div.style.padding = '10px 20px';
    div.style.borderRadius = '20px';
    div.style.fontWeight = 'bold';
    div.style.zIndex = '30000';
    div.style.boxShadow = '0 0 10px yellow';
    div.style.animation = 'fadeOut 2s forwards'; // ২ সেকেন্ড পর গায়েব

    document.body.appendChild(div);

    setTimeout(() => { div.remove(); }, 2000);
}

// --- ওয়াচ রিওয়ার্ড ফাংশন (আপডেটেড) ---
async function claimWatchReward(postId) {
    try {
        // 👇 লিংক আপডেট করা হয়েছে: /watch-video/
        const res = await fetch(`/watch-video/${postId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
        });
        
        const data = await res.json();

        if (data.success) {
            // সাউন্ড
            const audio = new Audio('https://upload.wikimedia.org/wikipedia/commons/2/29/Chime-bell-ding.wav');
            audio.play().catch(e => {});

            // টোস্ট মেসেজ
            showCoinToast("+1 Coin Earned! 🪙");

            // ব্যালেন্স আপডেট
            if(typeof updateNavBalance === 'function') updateNavBalance();
        }
    } catch (err) {
        console.log(err);
    }
}

// ================= TikTok স্টাইল শর্টস ক্রিয়েটর লজিক =================

let creatorStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let filterIndex = 0;
const filters = ['none', 'grayscale(1)', 'sepia(1)', 'invert(1)', 'saturate(2)'];

// ১. ক্রিয়েটর মোডাল ওপেন এবং ক্যামেরা চালু
async function openTikTokCreator() {
    document.getElementById('tiktok-creator-modal').style.display = 'block';
    const video = document.getElementById('creator-video-preview');

    try {
        creatorStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        video.srcObject = creatorStream;
    } catch (err) {
        alert("ক্যামেরা এক্সেস পাওয়া যায়নি!");
        closeTikTokCreator();
    }
}

// ২. বন্ধ করা
function closeTikTokCreator() {
    document.getElementById('tiktok-creator-modal').style.display = 'none';
    if (creatorStream) {
        creatorStream.getTracks().forEach(track => track.stop());
    }
}

// ================= স্টিকার সহ ভিডিও রেকর্ডিং (Canvas Recording) =================

let recordingInterval;

function toggleRecording() {
    const btn = document.getElementById('record-btn');
    const video = document.getElementById('creator-video-preview');
    const canvas = document.getElementById('composite-canvas');
    const ctx = canvas.getContext('2d');
    const stickerLayer = document.getElementById('sticker-overlay-layer');

    // ক্যানভাস সাইজ ভিডিওর সমান করা
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    if (btn.classList.contains('recording')) {
        // --- স্টপ রেকর্ডিং ---
        mediaRecorder.stop();
        btn.classList.remove('recording');
        clearInterval(recordingInterval);
    } else {
        // --- স্টার্ট রেকর্ডিং ---
        
        // ক্যানভাস স্ট্রিম তৈরি করা (ভিডিও + স্টিকার)
        const canvasStream = canvas.captureStream(30); // 30 FPS
        
        // অডিও এবং ভিডিও মিক্স করা
        const audioTrack = creatorStream.getAudioTracks()[0];
        const mixedStream = new MediaStream([...canvasStream.getTracks(), audioTrack]);

        mediaRecorder = new MediaRecorder(mixedStream);
        recordedChunks = [];

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) recordedChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
            const videoUrl = URL.createObjectURL(recordedBlob);
            
            document.getElementById('final-preview').src = videoUrl;
            closeTikTokCreator();
            document.getElementById('short-preview-modal').style.display = 'flex';
        };

        mediaRecorder.start();
        btn.classList.add('recording');

        // --- লুপ: ক্যানভাসে ভিডিও এবং স্টিকার আঁকা ---
        recordingInterval = setInterval(() => {
            // ১. ভিডিও আঁকা
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // ফিল্টার অ্যাপ্লাই করা (যদি থাকে)
            ctx.filter = video.style.filter || "none";

            // ২. স্টিকার আঁকা (সব স্টিকার লুপ করে)
            const stickers = stickerLayer.querySelectorAll('img');
            stickers.forEach(sticker => {
                // স্টিকারের পজিশন এবং সাইজ বের করা
                const rect = sticker.getBoundingClientRect();
                const videoRect = video.getBoundingClientRect();

                // অনুপাত বের করা (ভিডিওর আসল সাইজ vs স্ক্রিন সাইজ)
                const scaleX = canvas.width / videoRect.width;
                const scaleY = canvas.height / videoRect.height;

                const x = (rect.left - videoRect.left) * scaleX;
                const y = (rect.top - videoRect.top) * scaleY;
                const w = rect.width * scaleX;
                const h = rect.height * scaleY;

                ctx.drawImage(sticker, x, y, w, h);
            });
            
            ctx.filter = "none"; // ফিল্টার রিসেট

        }, 1000 / 30); // 30 FPS
    }
}

// ৪. ফিল্টার পরিবর্তন
function changeFilter() {
    filterIndex = (filterIndex + 1) % filters.length;
    document.getElementById('creator-video-preview').style.filter = filters[filterIndex];
}

// ৫. গ্যালারি থেকে আপলোড হ্যান্ডেল করা
function handleGalleryUpload() {
    const file = document.getElementById('shortGalleryInput').files[0];
    if (file) {
        recordedBlob = file; // ফাইলটি ব্লব হিসেবে সেট
        const videoUrl = URL.createObjectURL(file);
        
        document.getElementById('final-preview').src = videoUrl;
        
        closeTikTokCreator();
        document.getElementById('short-preview-modal').style.display = 'flex';
    }
}

// ৬. ফাইনাল আপলোড (সার্ভারে পাঠানো)
async function uploadRecordedShort() {
    if (!recordedBlob) return;

    const caption = document.getElementById('short-caption-input').value;
    const btn = document.querySelector('#short-preview-modal .btn-primary');
    
    const formData = new FormData();
    formData.append('username', currentUser);
    formData.append('caption', caption);
    formData.append('isShort', 'true'); // শর্টস হিসেবে মার্ক করা
    
    // ব্লব হলে ফাইলের নাম দিতে হয়
    const fileName = `short_${Date.now()}.mp4`;
    formData.append('mediaFile', recordedBlob, fileName);

    btn.innerText = "Uploading...";
    btn.disabled = true;

    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.success) {
            alert("শর্টস আপলোড সফল!");
            document.getElementById('short-preview-modal').style.display = 'none';
            loadPosts(); // রিফ্রেশ
        } else {
            alert("ব্যর্থ: " + data.error);
        }
    } catch (err) {
        alert("সার্ভার এরর");
    } finally {
        btn.innerText = "Post Short";
        btn.disabled = false;
    }
}

function discardRecording() {
    document.getElementById('short-preview-modal').style.display = 'none';
    recordedBlob = null;
    openTikTokCreator(); // আবার ক্যামেরা ওপেন
}

// ================= লাইভ স্ট্রিমিং সিস্টেম =================

let liveInterval = null;

// ১. লাইভ শুরু করা (TikTok Creator Modal থেকে)
function goLive() {
    const video = document.getElementById('creator-video-preview');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // বাটন আপডেট
    const liveBtn = document.querySelector('.creator-action-btn[onclick="goLive()"]'); // বাটনটি খুঁজে বের করা
    // (আমরা পরে HTML এ বাটনটি সেট করছি)

    alert("লাইভ শুরু হচ্ছে...");

    // সার্ভারে রুম তৈরি
    socket.emit('start_live_stream', { username: currentUser });

    // প্রতি ১০০ মিলিসেকেন্ডে ভিডিওর ছবি তুলে সার্ভারে পাঠানো
    liveInterval = setInterval(() => {
        if (!video.srcObject) return;

        canvas.width = 400; // কোয়ালিটি কমানো হয়েছে স্পিডের জন্য
        canvas.height = 600;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL("image/jpeg", 0.5); // কমপ্রেশন
        
        socket.emit('stream_data', { 
            room: currentUser, 
            image: imageData 
        });
    }, 100);

    // লাইভ চলাকালীন ক্লোজ বাটন পাল্টা কাজ করবে
    document.querySelector('#tiktok-creator-modal .close-btn').onclick = function() {
        endLive();
    };
}

// ২. লাইভ বন্ধ করা
function endLive() {
    clearInterval(liveInterval);
    liveInterval = null;
    alert("লাইভ শেষ হয়েছে!");
    closeTikTokCreator();
    location.reload(); // রিসেট করার জন্য
}

// ৩. লাইভ দেখা শুরু করা (Viewer)
function watchLive(streamerName) {
    const modal = document.getElementById('live-viewer-modal');
    const display = document.getElementById('live-feed-display');
    
    // মোডাল ওপেন
    modal.style.display = 'block';
    
    // সকেটে জয়েন করা
    socket.emit('join_live_room', streamerName);
    
    // লাইভ ডাটা রিসিভ করা
    socket.on('stream_feed', (image) => {
        display.src = image;
    });

    // কমেন্ট রিসিভ করা
    socket.on('receive_live_comment', (data) => {
        const chatBox = document.getElementById('live-chat-box');
        const div = document.createElement('div');
        div.innerHTML = `<b>${data.user}:</b> ${data.text}`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    // গ্লোবাল ভেরিয়েবলে স্ট্রিমার নাম রাখা (কমেন্টের জন্য)
    window.currentStreamer = streamerName;
}

// ৪. লাইভ কমেন্ট পাঠানো
function sendLiveComment() {
    const input = document.getElementById('liveCommentInput');
    const text = input.value;
    if(!text) return;

    socket.emit('send_live_comment', {
        room: window.currentStreamer,
        user: currentUser,
        text: text
    });
    input.value = '';
}

// ৫. লাইভ দেখা বন্ধ করা
function closeLiveViewer() {
    document.getElementById('live-viewer-modal').style.display = 'none';
    socket.off('stream_feed'); // ডাটা নেওয়া বন্ধ
}

// --- ১. রিপোর্ট ফাংশন ---
async function reportContent(id, type) {
    const reason = prompt("রিপোর্ট করার কারণ কি? (যেমন: স্প্যাম, খারাপ কন্টেন্ট)");
    if (!reason) return;

    try {
        const res = await fetch('/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reporter: currentUser, reportedId: id, reason: reason, type: type })
        });
        const data = await res.json();
        alert(data.message);
    } catch (err) {
        alert("রিপোর্ট পাঠানো যায়নি।");
    }
}

// --- ২. ব্লক ইউজার ফাংশন ---
async function blockUser(userToBlock) {
    if(!confirm(`আপনি কি ${userToBlock}-কে ব্লক করতে চান? আপনি আর তার পোস্ট দেখতে পাবেন না।`)) return;

    try {
        const res = await fetch('/block-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, blockedUser: userToBlock })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            location.reload(); // পেজ রিলোড দিলে তার পোস্ট চলে যাবে
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert("সার্ভার সমস্যা।");
    }
}
// --- মোবাইল সার্চ বার টগল (Open/Close) ---
function toggleMobileSearch() {
    const box = document.getElementById('mobileSearchBox');
    const input = document.getElementById('searchInput');

    // শুধুমাত্র মোবাইলে কাজ করবে (স্ক্রিন সাইজ চেক)
    if (window.innerWidth <= 768) {
        box.classList.toggle('active'); // ক্লাস যোগ/বিয়োগ করবে
        
        // যদি ওপেন হয়, ইনপুটে ফোকাস করবে
        if (box.classList.contains('active')) {
            input.focus();
        }
    }
}

// সার্চ বারের বাইরে ক্লিক করলে বন্ধ হয়ে যাবে
document.addEventListener('click', function(event) {
    const box = document.getElementById('mobileSearchBox');
    const isClickInside = box.contains(event.target);
    
    // যদি বাইরে ক্লিক হয় এবং বক্স খোলা থাকে
    if (!isClickInside && box.classList.contains('active')) {
        box.classList.remove('active');
    }
});

// ================= ব্লক লিস্ট ম্যানেজমেন্ট =================

// ১. মোডাল ওপেন এবং লিস্ট লোড করা
async function openBlockedListModal() {
    // সেটিংস মেনু বন্ধ করা
    document.getElementById('settings-dropdown').style.display = 'none';
    
    const modal = document.getElementById('blocked-list-modal');
    const container = document.getElementById('blocked-users-container');
    
    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:20px;">🔄 লোডিং...</div>';

    try {
        const res = await fetch('/get-blocked-users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
        });
        
        const blockedUsers = await res.json();

        if (blockedUsers.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:gray;">কাউকে ব্লক করা হয়নি।</div>';
            return;
        }

        let html = '';
        blockedUsers.forEach(user => {
            const pic = user.profilePic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
            
            html += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:10px; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${pic}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                        <span style="font-weight:bold;">${user.username}</span>
                    </div>
                    <button onclick="unblockUser('${user.username}')" class="btn-secondary" style="border:1px solid red; color:red; font-size:12px; padding:5px 10px;">
                        Unblock
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (err) {
        console.log(err);
        container.innerHTML = '<p style="color:red; text-align:center;">সমস্যা হয়েছে!</p>';
    }
}

// ২. আনব্লক ফাংশন
async function unblockUser(targetUser) {
    if(!confirm(`আপনি কি ${targetUser}-কে আনব্লক করতে চান?`)) return;

    try {
        const res = await fetch('/unblock-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, blockedUser: targetUser })
        });

        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            openBlockedListModal(); // লিস্ট রিফ্রেশ
            loadPosts(); // ফিড রিফ্রেশ (যাতে আনব্লক করা ইউজারের পোস্ট আবার আসে)
        } else {
            alert("ব্যর্থ!");
        }
    } catch (err) {
        alert("সার্ভার সমস্যা");
    }
}

// ================= চ্যাট সেটিংস ও ব্লক সিস্টেম =================

// ১. সেটিংস মেনু টগল (আপডেটেড)
async function toggleChatSettings() {
    const menu = document.getElementById('chat-settings-menu');
    
    if (menu.style.display === 'none' || menu.style.display === '') {
        try {
            // ডাটা চেক
            const res = await fetch('/users');
            const allUsers = await res.json();
            const me = allUsers.find(u => u.username === currentUser);

            const isBlocked = me.blockedUsers && me.blockedUsers.includes(currentChatFriend);
            const isMuted = me.mutedUsers && me.mutedUsers.includes(currentChatFriend);

            menu.innerHTML = `
                <div onclick="changeChatTheme()">🎨 Change Theme</div>
                <div onclick="deleteChatHistory()">🗑️ Delete Chat</div>
                
                <div onclick="toggleMuteStatus('${isMuted}')">
                    ${isMuted ? '🔊 Unmute' : '🔕 Mute'}
                </div>

                <!-- 👇 ব্লক/আনব্লক বাটন -->
                <div onclick="toggleBlockStatus('${isBlocked}')" style="color: red;">
                    ${isBlocked ? '✅ Unblock User' : '🚫 Block User'}
                </div>

                <!-- 👇 ব্লক লিস্ট দেখার বাটন -->
                <div onclick="openBlockedListModal()" style="border-top:1px solid #eee; margin-top:5px; padding-top:5px;">
                    📜 View Blocked List
                </div>
            `;

            menu.style.display = 'block';
        } catch (err) { console.log(err); }
    } else {
        menu.style.display = 'none';
    }
}

// ২. ব্লক/আন-ব্লক টগল ফাংশন
async function toggleBlockStatus(isBlocked) {
    const currentStatus = (isBlocked === 'true');
    const url = currentStatus ? '/unblock-user' : '/block-user';
    const actionText = currentStatus ? "আনব্লক" : "ব্লক";

    if(!confirm(`আপনি কি নিশ্চিত ${currentChatFriend}-কে ${actionText} করতে চান?`)) return;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, blockedUser: currentChatFriend })
        });
        const data = await res.json();

        if (data.success) {
            alert(data.message);
            document.getElementById('chat-settings-menu').style.display = 'none';
            
            // ব্লক করলে চ্যাট বন্ধ হবে
            if(!currentStatus) {
                closeChat();
                if(typeof loadPosts === 'function') loadPosts(); 
            }
        }
    } catch (err) { alert("সার্ভার সমস্যা!"); }
}

// ৩. ব্লক লিস্ট মোডাল ওপেন করা
async function openBlockedListModal() {
    document.getElementById('chat-settings-menu').style.display = 'none';
    
    const modal = document.getElementById('blocked-list-modal');
    const container = document.getElementById('blocked-users-container');
    
    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:20px;">🔄 লোডিং...</div>';

    try {
        // ব্লক করা ইউজারদের লিস্ট আনা (সার্ভার থেকে)
        // (আমাদের সার্ভারে /get-blocked-users রাউট থাকতে হবে, যা আগে বানিয়েছিলাম)
        // যদি না থাকে তবে /users ফেচ করে ফিল্টার করব
        
        const res = await fetch('/users');
        const allUsers = await res.json();
        const me = allUsers.find(u => u.username === currentUser);
        const blockedList = me.blockedUsers || [];

        if (blockedList.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:gray;">কাউকে ব্লক করা হয়নি।</div>';
            return;
        }

        let html = '';
        blockedList.forEach(blockedName => {
            const user = allUsers.find(u => u.username === blockedName);
            const pic = user ? user.profilePic : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
            
            html += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:10px; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${pic}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                        <span style="font-weight:bold;">${blockedName}</span>
                    </div>
                    <button onclick="unblockUser('${blockedName}')" class="btn-secondary" style="border:1px solid red; color:red; font-size:12px; padding:5px 10px;">
                        Unblock
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (err) {
        console.log(err);
        container.innerHTML = '<p style="color:red; text-align:center;">সমস্যা হয়েছে!</p>';
    }
}

// ৪. আনব্লক ফাংশন (লিস্ট থেকে)
async function unblockUser(targetUser) {
    if(!confirm(`আপনি কি ${targetUser}-কে আনব্লক করতে চান?`)) return;

    try {
        const res = await fetch('/unblock-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, blockedUser: targetUser })
        });

        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            openBlockedListModal(); // লিস্ট রিফ্রেশ
        } else {
            alert("ব্যর্থ!");
        }
    } catch (err) { alert("সার্ভার সমস্যা"); }
}

// ২. চ্যাট থিম পরিবর্তন (রঙ বদলানো)
const chatColors = ['#1877f2', '#e91e63', '#00b894', '#6c5ce7', '#e17055'];
let colorIndex = 0;

function changeChatTheme() {
    colorIndex = (colorIndex + 1) % chatColors.length;
    const newColor = chatColors[colorIndex];
    
    // হেডারের কালার বদলানো
    document.querySelector('.glass-chat-header').style.background = newColor;
    
    // নিজের মেসেজের কালার বদলানো
    const myMsgs = document.querySelectorAll('.my-msg');
    myMsgs.forEach(msg => {
        msg.style.background = newColor;
    });

    document.getElementById('chat-settings-menu').style.display = 'none';
}

// ৩. চ্যাট ডিলিট করা
async function deleteChatHistory() {
    if(!confirm("আপনি কি নিশ্চিত সব মেসেজ মুছে ফেলতে চান?")) return;

    try {
        const res = await fetch(`/delete-chat/${currentUser}/${currentChatFriend}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if(data.success) {
            document.getElementById('chat-messages').innerHTML = ''; // স্ক্রিন ক্লিয়ার
            alert(data.message);
        }
    } catch(err) {
        alert("সমস্যা হয়েছে!");
    }
    document.getElementById('chat-settings-menu').style.display = 'none';
}

// ৪. মিউট/আন-মিউট টগল ফাংশন (Real Server)
async function toggleMuteStatus(isMuted) {
    const currentStatus = (isMuted === 'true'); 
    const url = currentStatus ? '/unmute-user' : '/mute-user';

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, targetUser: currentChatFriend })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            document.getElementById('chat-settings-menu').style.display = 'none';
        }
    } catch (err) {
        alert("সার্ভার সমস্যা!");
    }
}


// ================= সাধারণ পোস্ট কমেন্ট সিস্টেম =================

// ১. কমেন্ট মোডাল ওপেন করা
async function openPostComments(postId) {
    const modal = document.getElementById('post-comment-modal');
    const list = document.getElementById('post-comments-list');
    const btn = document.getElementById('postCommentBtn');
    const myPic = document.getElementById('modal-my-pic');

    // আমার ছবি সেট করা
    myPic.src = localStorage.getItem('profilePic') || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    
    // মোডাল দেখানো
    modal.style.display = 'flex';
    list.innerHTML = '<div style="text-align:center; padding:20px;">🔄 লোডিং...</div>';

    // সেন্ড বাটনে লজিক সেট করা
    btn.onclick = function() { addPostComment(postId); };

    try {
        // সার্ভার থেকে পোস্ট আনা
        const res = await fetch('/posts');
        const posts = await res.json();
        const post = posts.find(p => p._id === postId);

        // সব ইউজার আনা (ছবি দেখানোর জন্য)
        // (বড় অ্যাপে আমরা প্রতিবার সব ইউজার আনি না, কিন্তু এখানে সহজ করার জন্য আনছি)
        const userRes = await fetch('/users');
        const allUsers = await userRes.json();

        list.innerHTML = ''; // লোডিং ক্লিয়ার

        if (!post.comments || post.comments.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:gray; margin-top:50px;">কোনো কমেন্ট নেই।<br>প্রথম কমেন্টটি আপনি করুন!</div>';
        } else {
            // আমাদের আগের renderSingleComment ফাংশন ব্যবহার করে সব কমেন্ট দেখানো
            post.comments.forEach(c => {
                // ইউজারের সঠিক ছবি বের করা
                const commenter = allUsers.find(u => u.username === c.user);
                // আমরা renderSingleComment এ ছবি পাস করার ব্যবস্থা করিনি আগে, তাই এখানে ম্যানুয়ালি করতে পারি
                // অথবা renderSingleComment আপডেট করতে পারি।
                // সহজ উপায়: আমরা HTML স্ট্রিং এখানে তৈরি করি:
                
                const pic = commenter ? commenter.profilePic : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
                
                // আগের renderSingleComment ফাংশনটি HTML রিটার্ন করে, আমরা সেটা ব্যবহার করব
                // তবে ছবিটা ডাইনামিক করার জন্য আমাদের renderSingleComment ফাংশনে ছবি পাস করা উচিত ছিল।
                // সমস্যা নেই, আমরা এখানে সরাসরি কোড বসাচ্ছি:
                
                let repliesHTML = '';
                if(c.replies) {
                    c.replies.forEach(r => {
                        repliesHTML += `
                        <div style="margin-top:5px; margin-left:40px; font-size:13px; display:flex; gap:5px;">
                            <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" style="width:20px; height:20px; border-radius:50%;">
                            <div style="background:#e4e6eb; padding:5px 10px; border-radius:10px;">
                                <b>${r.user}</b> ${r.text}
                            </div>
                        </div>`;
                    });
                }

                const div = document.createElement('div');
                div.innerHTML = `
                    <div class="comment-wrapper" style="margin-bottom:15px;">
                        <div style="display:flex; gap:8px;">
                            <img src="${pic}" class="comment-avatar" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                            <div>
                                <div class="comment-bubble" style="background:#f0f2f5; padding:8px 12px; border-radius:18px; display:inline-block;">
                                    <b style="cursor:pointer;" onclick="viewUserProfile('${c.user}')">${c.user}</b> 
                                    <span style="margin-left:5px;">${c.text}</span>
                                </div>
                                <div style="font-size:12px; color:gray; margin-left:10px; margin-top:2px; display:flex; gap:10px;">
                                    <span style="cursor:pointer; font-weight:bold;" onclick="likeComment('${postId}', '${c._id}')">Like (${c.likes || 0})</span>
                                    <span style="cursor:pointer; font-weight:bold;" onclick="document.getElementById('modal-reply-box-${c._id}').style.display='flex'">Reply</span>
                                    <span>Just now</span>
                                </div>
                            </div>
                        </div>
                        
                        ${repliesHTML}

                        <!-- রিপ্লাই বক্স -->
                        <div id="modal-reply-box-${c._id}" style="display:none; margin-top:5px; margin-left:45px; gap:5px;">
                            <input type="text" id="modal-reply-input-${c._id}" placeholder="Reply..." style="padding:5px; border-radius:15px; border:1px solid #ddd; font-size:12px; width:150px;">
                            <button onclick="submitModalReply('${postId}', '${c._id}')" style="font-size:11px; background:none; border:none; color:blue; cursor:pointer;">Send</button>
                        </div>
                    </div>`;
                
                list.appendChild(div);
            });
        }
    } catch(err) { console.log(err); }
}

// ২. কমেন্ট পোস্ট করা (মোডাল থেকে)
async function addPostComment(postId) {
    const input = document.getElementById('postCommentInput');
    const text = input.value;
    if(!text) return;

    try {
        const res = await fetch(`/comment/${postId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser, text: text })
        });
        
        if(res.ok) {
            input.value = '';
            openPostComments(postId); // লিস্ট রিফ্রেশ
            // হোম পেজ রিফ্রেশ না করলেও চলবে, বাটন ক্লিক করলে আবার লোড হবে
        }
    } catch(err) { alert("সমস্যা হয়েছে"); }
}

// ৩. রিপ্লাই সাবমিট (মোডাল এর জন্য)
async function submitModalReply(postId, commentId) {
    const input = document.getElementById(`modal-reply-input-${commentId}`);
    const text = input.value;
    if(!text) return;

    await fetch(`/reply-comment/${postId}/${commentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser, text: text })
    });

    openPostComments(postId); // রিফ্রেশ
}

// ================= ভিডিও/অডিও কলিং সিস্টেম =================

let localStream;
let callRingtone = new Audio('https://upload.wikimedia.org/wikipedia/commons/e/e9/Ringtone_%283%29.ogg');

let currentCallType = 'video'; // ডিফল্ট

// --- ১. কল শুরু করা (Caller) - Socket + PeerJS + Timer ---
async function startCall(type) {
    if (!currentChatFriend) return alert("চ্যাট ওপেন করুন!");
    
    // টাইপ গ্লোবালি সেভ রাখা
    currentCallType = type; 

    // চ্যাট বক্সে মেসেজ দেখানো
    const icon = type === 'video' ? '📹' : '📞';
    appendMessage(`${icon} Calling ${currentChatFriend}...`, 'my-msg');

    // ১. নিজের ক্যামেরা/মাইক চালু করা
    try {
        const constraints = {
            audio: true,
            video: (type === 'video') // ভিডিও হলে ট্রু, অডিও হলে ফলস
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStream = stream; // স্ট্রীম সেভ রাখা

        // ভিডিও স্ক্রিন ওপেন করা
        const screen = document.getElementById('video-call-screen');
        screen.style.display = 'block';

        const localVid = document.getElementById('local-video');
        const remoteVid = document.getElementById('remote-video');

        // অডিও কল হলে স্ক্রিন কালো, ভিডিও হলে ক্যামেরা অন
        if (type === 'audio') {
            localVid.style.display = 'none';
            remoteVid.style.display = 'none';
            screen.style.background = '#222';
            screen.innerHTML += `<div id="audio-call-ui" style="position:absolute; top:40%; left:50%; transform:translate(-50%,-50%); color:white; text-align:center;">
                                    <h3>Calling...</h3>
                                 </div>`;
        } else {
            // ভিডিও হলে ক্যামেরা ফিড দেখানো
            localVid.style.display = 'block';
            remoteVid.style.display = 'block';
            localVid.srcObject = stream;
            
            // আগের অডিও UI থাকলে মুছে ফেলা
            const oldUI = document.getElementById('audio-call-ui');
            if(oldUI) oldUI.remove();
        }

        // ২. PeerJS দিয়ে কল করা
        if (window.myPeer) {
            const call = window.myPeer.call(currentChatFriend, stream);
            window.currentCall = call; // কল সেভ রাখা

            // ৩. অপর পাশের ভিডিও/অডিও রিসিভ করা (Connected)
            call.on('stream', (remoteStream) => {
                const remoteVideoElement = document.getElementById('remote-video');
                remoteVideoElement.srcObject = remoteStream;
                
                // 👇 কল রিসিভ হলে টাইমার চালু হবে
                if (typeof startCallTimer === 'function') {
                    startCallTimer();
                }

                // অডিও কল হলে শুধু সাউন্ড আসবে, ভিডিও দেখাবে না
                if (type === 'audio') {
                    const audioMsg = document.querySelector('#audio-call-ui h3');
                    if(audioMsg) audioMsg.innerText = "Connected";
                }
            });

            // কল শেষ হলে
            call.on('close', () => {
                endCall();
            });
            
            call.on('error', (err) => {
                console.log("Call Error:", err);
                alert("কল কানেক্ট করা যাচ্ছে না!");
                endCall();
            });
        } else {
            console.log("PeerJS not ready!");
        }

        // ৪. নোটিফিকেশন পাঠানো (Socket দিয়ে)
        socket.emit('call_user', {
            sender: currentUser,
            receiver: currentChatFriend,
            type: type
        });

    } catch (err) {
        console.log(err);
        alert("ক্যামেরা বা মাইক্রোফোন চালু করা যাচ্ছে না।");
    }
}

// ২. ইনকামিং কল রিসিভ করা
socket.on('incoming_call', (data) => {
    if (data.receiver === currentUser) {
        // টাইপ সেভ করা (যাতে রিসিভ করলে সঠিক মোড অন হয়)
        currentCallType = data.type; 
        
        const modal = document.getElementById('incoming-call-modal');
        document.getElementById('caller-name').innerText = data.sender;
        
        // আইকন এবং টেক্সট ঠিক করা
        const icon = data.type === 'video' ? '📹' : '📞';
        document.getElementById('call-type-text').innerText = `Incoming ${data.type.toUpperCase()} Call... ${icon}`;
        
        modal.style.display = 'flex';
        callRingtone.play().catch(e=>{});
        window.incomingCaller = data.sender;
    }
});

// --- ৩. কল এক্সেপ্ট করা (Socket + PeerJS + Timer) ---
async function acceptCall() {
    // ১. রিংটোন বন্ধ করা
    if(typeof callRingtone !== 'undefined') {
        callRingtone.pause();
        callRingtone.currentTime = 0;
    }
    
    // মোডাল বন্ধ করা
    const modal = document.getElementById('incoming-call-modal');
    if(modal) modal.style.display = 'none';
    
    // ২. সার্ভারে জানানো (যাতে অপরপক্ষ জানে আপনি রিসিভ করেছেন)
    if(typeof socket !== 'undefined') {
        socket.emit('answer_call', { sender: currentUser, receiver: window.incomingCaller });
    }

    // ৩. ক্যামেরা এবং ভিডিও স্ক্রিন চালু করা
    try {
        // অডিও/ভিডিও পারমিশন নেওয়া
        const constraints = {
            audio: true,
            video: (typeof currentCallType !== 'undefined' && currentCallType === 'video')
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStream = stream; // গ্লোবাল ভেরিয়েবলে রাখা

        // ভিডিও স্ক্রিন দেখানো
        const screen = document.getElementById('video-call-screen');
        screen.style.display = 'block';

        // নিজের ভিডিও দেখানো (যদি ভিডিও কল হয়)
        const localVid = document.getElementById('local-video');
        if (constraints.video) {
            localVid.srcObject = stream;
            localVid.style.display = 'block';
        } else {
            localVid.style.display = 'none'; // অডিও হলে নিজের ভিডিও অফ
            screen.style.background = '#222'; // কালো ব্যাকগ্রাউন্ড
        }
        
        // 👇 ৪. টাইমার চালু করা (নতুন যোগ করা হয়েছে)
        if(typeof startCallTimer === 'function') {
            startCallTimer();
        }

        // ৫. PeerJS দিয়ে কলের উত্তর দেওয়া (স্ট্রিম পাঠানো)
        if (window.currentCall) {
            window.currentCall.answer(stream); // আমার স্ট্রিম পাঠানো হলো
            
            // ৬. অপর পাশের স্ট্রিম রিসিভ করা
            window.currentCall.on('stream', (remoteStream) => {
                const remoteVid = document.getElementById('remote-video');
                remoteVid.srcObject = remoteStream;
                
                // অডিও হলে রিমোট ভিডিও হাইড, কিন্তু অডিও চলবে
                if (!constraints.video) {
                    remoteVid.style.display = 'none';
                } else {
                    remoteVid.style.display = 'block';
                }
            });
            
            // কল কেটে দিলে হ্যান্ডেল করা
            window.currentCall.on('close', () => {
                endCall();
            });
        }

    } catch (err) {
        console.log(err);
        alert("ক্যামেরা বা মাইক্রোফোন চালু করা যাচ্ছে না!");
        endCall();
    }
}
// ৪. কল রিজেক্ট করা
function rejectCall() {
    callRingtone.pause();
    callRingtone.currentTime = 0;
    document.getElementById('incoming-call-modal').style.display = 'none';
    
    // সার্ভারে জানানো
    socket.emit('end_call', { sender: currentUser, receiver: window.incomingCaller });
}


// ৭. ক্যামেরা/মাইক চালু করা (অডিও/ভিডিও লজিক সহ)
async function openVideoScreen() {
    const screen = document.getElementById('video-call-screen');
    const localVid = document.getElementById('local-video');
    const remoteVid = document.getElementById('remote-video');

    screen.style.display = 'block';
    
    // অডিও কল হলে স্ক্রিন কালো বা প্রোফাইল ছবি দেখাবে
    if (currentCallType === 'audio') {
        remoteVid.style.display = 'none'; // ভিডিও ট্যাগ লুকানো
        localVid.style.display = 'none';
        
        // অডিও কলের জন্য একটি আইকন বা ছবি দেখানো (HTML এ যোগ করতে পারেন)
        // আপাতত ব্যাকগ্রাউন্ড কালোই থাকছে
        screen.style.background = '#222'; 
        screen.innerHTML += `<div style="position:absolute; top:40%; left:50%; transform:translate(-50%,-50%); color:white; text-align:center;">
                                <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" style="width:100px; border-radius:50%; border:3px solid lime;">
                                <h3>Audio Call Active</h3>
                             </div>`;
    } else {
        // ভিডিও কল হলে ভিডিও ট্যাগ দেখাবে
        remoteVid.style.display = 'block';
        localVid.style.display = 'block';
    }

    try {
        // 👇 আসল লজিক: অডিও হলে video: false, ভিডিও হলে video: true
        const constraints = {
            audio: true,
            video: currentCallType === 'video' 
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // ভিডিও হলে স্ট্রীম সেট করা
        if (currentCallType === 'video') {
            localVid.srcObject = localStream;
            remoteVid.srcObject = localStream; // ডেমো হিসেবে নিজেরটাই দেখাচ্ছি
        }

    } catch (err) {
        alert("মাইক্রোফোন বা ক্যামেরা পাওয়া যায়নি!");
        endCall();
    }
}

// ================= ফিল্টার সিস্টেম (ইমেজ থাম্বনেইল সহ) =================

// ১. ফিল্টার ডাটা (নাম, ভ্যালু, ছবি)
const filterBaseImages = [
    "https://cdn.pixabay.com/photo/2015/03/03/05/56/girl-657753_1280.jpg",
    "https://cdn.pixabay.com/photo/2016/11/29/03/36/woman-1867093_1280.jpg",
    "https://cdn.pixabay.com/photo/2017/08/01/01/33/beanie-2562646_1280.jpg",
    "https://cdn.pixabay.com/photo/2018/01/13/19/39/fashion-3080644_1280.jpg",
    "https://cdn.pixabay.com/photo/2019/11/03/20/11/portrait-4599553_1280.jpg"
];

// ২. ফিল্টার জেনারেট এবং লোড করা
function loadFilters() {
    const container = document.getElementById('filter-list-container');
    let html = '';

    // বেসিক ফিল্টারগুলো (৫০টি তৈরি হবে)
    for (let i = 0; i < 50; i++) {
        // রেন্ডম ফিল্টার ইফেক্ট তৈরি
        const hue = Math.floor(Math.random() * 360);
        const contrast = (Math.random() * 0.5 + 0.8).toFixed(1);
        const filterValue = i === 0 ? 'none' : `hue-rotate(${hue}deg) contrast(${contrast})`;
        
        // রেন্ডম ছবি সিলেক্ট করা (উপরের লিস্ট থেকে)
        const randomImg = filterBaseImages[i % filterBaseImages.length];
        
        const filterName = i === 0 ? "Normal" : `Filter ${i}`;

        html += `
        <div onclick="applyFilter('${filterValue}')" style="text-align: center; cursor: pointer; margin-right: 10px;">
            <div style="width: 55px; height: 55px; border-radius: 50%; border: 2px solid white; overflow: hidden; position: relative;">
                
                <!-- এই ইমেজটিতেও ফিল্টার অ্যাপ্লাই হবে যাতে প্রিভিউ বোঝা যায় -->
                <img src="${randomImg}" style="width: 100%; height: 100%; object-fit: cover; filter: ${filterValue};">
            
            </div>
            <span style="font-size: 10px; color: white; display: block; margin-top: 5px;">${filterName}</span>
        </div>`;
    }

    container.innerHTML = html;
}

// ৩. ভিডিওতে ফিল্টার অ্যাপ্লাই করা
function applyFilter(filterValue) {
    const video = document.getElementById('creator-video-preview');
    if (video) {
        video.style.filter = filterValue;
    }
}

// ৪. ফিল্টার প্যানেল টগল (আগের মতোই)
function toggleFilterPanel() {
    const panel = document.getElementById('filter-selection-panel');
    const container = document.getElementById('filter-list-container');

    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        if (container.innerHTML === '') loadFilters();
    } else {
        panel.style.display = 'none';
    }
}

// ================= নতুন ৫০টি স্টিকার (TikTok স্টাইল) =================

const stickers = [
    // চশমা (Glasses)
    "https://cdn-icons-png.flaticon.com/512/166/166538.png", 
    "https://cdn-icons-png.flaticon.com/512/187/187979.png", 
    "https://cdn-icons-png.flaticon.com/512/4412/4412952.png", 
    "https://cdn-icons-png.flaticon.com/512/616/616430.png", 
    "https://cdn-icons-png.flaticon.com/512/3257/3257933.png", 
    
    // টুপি (Hats)
    "https://cdn-icons-png.flaticon.com/512/4754/4754215.png",
    "https://cdn-icons-png.flaticon.com/512/7479/7479705.png",
    "https://cdn-icons-png.flaticon.com/512/1066/1066373.png",
    "https://cdn-icons-png.flaticon.com/512/1973/1973839.png",
    "https://cdn-icons-png.flaticon.com/512/3050/3050257.png",

    // মাস্ক ও গোঁফ (Masks & Mustache)
    "https://cdn-icons-png.flaticon.com/512/744/744546.png",
    "https://cdn-icons-png.flaticon.com/512/1165/1165688.png",
    "https://cdn-icons-png.flaticon.com/512/4204/4204987.png",
    "https://cdn-icons-png.flaticon.com/512/3063/3063065.png",
    "https://cdn-icons-png.flaticon.com/512/6276/6276859.png",

    // ফানি ইমোজি (Funny Emojis)
    "https://cdn-icons-png.flaticon.com/512/742/742751.png",
    "https://cdn-icons-png.flaticon.com/512/742/742923.png",
    "https://cdn-icons-png.flaticon.com/512/725/725107.png",
    "https://cdn-icons-png.flaticon.com/512/742/742752.png",
    "https://cdn-icons-png.flaticon.com/512/742/742918.png",

    // পশু-পাখি (Animals)
    "https://cdn-icons-png.flaticon.com/512/194/194279.png", // কুকুর
    "https://cdn-icons-png.flaticon.com/512/616/616408.png", // বিড়াল
    "https://cdn-icons-png.flaticon.com/512/3069/3069172.png", // পান্ডা
    "https://cdn-icons-png.flaticon.com/512/194/194246.png", // বাঘ
    "https://cdn-icons-png.flaticon.com/512/616/616438.png", // সিংহ

    // লাভ ও হার্ট (Love)
    "https://cdn-icons-png.flaticon.com/512/833/833472.png",
    "https://cdn-icons-png.flaticon.com/512/1077/1077035.png",
    "https://cdn-icons-png.flaticon.com/512/148/148836.png",
    "https://cdn-icons-png.flaticon.com/512/2107/2107952.png",
    "https://cdn-icons-png.flaticon.com/512/1216/1216656.png",

    // ফায়ার ও ইফেক্ট (Fire & Effects)
    "https://cdn-icons-png.flaticon.com/512/785/785116.png",
    "https://cdn-icons-png.flaticon.com/512/426/426833.png",
    "https://cdn-icons-png.flaticon.com/512/992/992482.png",
    "https://cdn-icons-png.flaticon.com/512/2917/2917757.png",
    "https://cdn-icons-png.flaticon.com/512/1828/1828884.png",

    // টেক্সট বাবল (Text Bubbles)
    "https://cdn-icons-png.flaticon.com/512/3050/3050474.png", // OMG
    "https://cdn-icons-png.flaticon.com/512/3050/3050519.png", // WOW
    "https://cdn-icons-png.flaticon.com/512/3050/3050478.png", // LOL
    "https://cdn-icons-png.flaticon.com/512/3050/3050482.png", // YES
    "https://cdn-icons-png.flaticon.com/512/3050/3050493.png", // NO

    // মুকুট (Crowns)
    "https://cdn-icons-png.flaticon.com/512/263/263100.png",
    "https://cdn-icons-png.flaticon.com/512/1490/1490817.png",
    "https://cdn-icons-png.flaticon.com/512/864/864685.png",
    "https://cdn-icons-png.flaticon.com/512/619/619089.png",
    "https://cdn-icons-png.flaticon.com/512/3028/3028574.png",

    // অন্যান্য (Misc)
    "https://cdn-icons-png.flaticon.com/512/2415/2415355.png", // গিটার
    "https://cdn-icons-png.flaticon.com/512/1165/1165242.png", // ফুটবল
    "https://cdn-icons-png.flaticon.com/512/2906/2906274.png", // মিউজিক
    "https://cdn-icons-png.flaticon.com/512/2904/2904856.png", // ক্যামেরা
    "https://cdn-icons-png.flaticon.com/512/2904/2904847.png"  // স্টার
];

// ১. স্টিকার প্যানেল ওপেন
function toggleStickerPanel() {
    const panel = document.getElementById('sticker-selection-panel');
    const list = document.getElementById('sticker-list-container');
    
    // ফিল্টার প্যানেল বন্ধ করা (যাতে ওভারল্যাপ না হয়)
    document.getElementById('filter-selection-panel').style.display = 'none';

    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        if (list.innerHTML === '') {
            stickers.forEach(src => {
                list.innerHTML += `
                    <img src="${src}" onclick="addStickerToVideo('${src}')" 
                    style="width: 50px; height: 50px; cursor: pointer; background: white; border-radius: 10px; padding: 5px;">
                `;
            });
        }
    } else {
        panel.style.display = 'none';
    }
}

// ২. ভিডিওতে স্টিকার বসানো
function addStickerToVideo(src) {
    const layer = document.getElementById('sticker-overlay-layer');
    
    // আগের স্টিকার মুছতে চাইলে: layer.innerHTML = ''; 
    
    const img = document.createElement('img');
    img.src = src;
    img.style.position = 'absolute';
    img.style.top = '50%';
    img.style.left = '50%';
    img.style.transform = 'translate(-50%, -50%)';
    img.style.width = '150px';
    img.style.pointerEvents = 'auto'; // যাতে ড্র্যাগ করা যায়
    img.style.cursor = 'move';
    
    // ড্র্যাগ লজিক
    makeDraggable(img);
    
    layer.appendChild(img);
    toggleStickerPanel(); // প্যানেল বন্ধ
}

// --- স্টিকার ড্র্যাগ এবং টাচ মুভ ---
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    element.onmousedown = dragStart;
    element.ontouchstart = dragStart; // মোবাইলের জন্য

    function dragStart(e) {
        e.preventDefault();
        // মাউস বা টাচ ইভেন্ট চেক
        if (e.type === 'touchstart') {
            pos3 = e.touches[0].clientX;
            pos4 = e.touches[0].clientY;
        } else {
            pos3 = e.clientX;
            pos4 = e.clientY;
        }

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementDrag;
    }

    function elementDrag(e) {
        let clientX, clientY;
        
        if (e.type === 'touchmove') {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        pos1 = pos3 - clientX;
        pos2 = pos4 - clientY;
        pos3 = clientX;
        pos4 = clientY;

        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}

// --- শর্টস মেনু কন্ট্রোল ---

// ১. মেনু ওপেন করা
function openShortsMenu(postId, username, mediaUrl) {
    const modal = document.getElementById('shorts-menu-modal');
    const list = document.getElementById('shorts-menu-list');
    
    // ডাউনলোড ফাংশন রেডি করা
    const downloadAction = `downloadMedia('${mediaUrl}', 'video')`;

    let html = '';

    // ক. যদি নিজের ভিডিও হয়
    if (username === currentUser) {
        html = `
            <div class="shorts-menu-option" onclick="${downloadAction}">
                <i class="fas fa-download"></i> <span>Save Video</span>
            </div>
            <div class="shorts-menu-option text-red" onclick="deletePost('${postId}')">
                <i class="fas fa-trash-alt"></i> <span>Delete</span>
            </div>
        `;
    } 
    // খ. যদি অন্যের ভিডিও হয়
    else {
        html = `
            <div class="shorts-menu-option" onclick="${downloadAction}">
                <i class="fas fa-download"></i> <span>Save Video</span>
            </div>
            <div class="shorts-menu-option" onclick="alert('Not Interested হিসেবে মার্ক করা হয়েছে!')">
                <i class="fas fa-eye-slash"></i> <span>Not Interested</span>
            </div>
            <div class="shorts-menu-option text-red" onclick="reportContent('${postId}', 'short')">
                <i class="fas fa-flag"></i> <span>Report</span>
            </div>
            <div class="shorts-menu-option text-red" onclick="blockUser('${username}')">
                <i class="fas fa-ban"></i> <span>Block ${username}</span>
            </div>
        `;
    }

    list.innerHTML = html;
    modal.style.display = 'flex';
}

// ২. মেনু বন্ধ করা
function closeShortsMenu() {
    document.getElementById('shorts-menu-modal').style.display = 'none';
}

// ================= ভিডিও কল কন্ট্রোল ফাংশন =================

// ১. ভিডিও অফ/অন করা
function toggleVideoMute() {
    const videoTrack = localStream.getVideoTracks()[0];
    const btn = document.getElementById('btn-video-mute');

    if (videoTrack.enabled) {
        videoTrack.enabled = false; // ভিডিও অফ
        btn.classList.add('off');
        btn.innerHTML = '<i class="fas fa-video-slash"></i>';
    } else {
        videoTrack.enabled = true; // ভিডিও অন
        btn.classList.remove('off');
        btn.innerHTML = '<i class="fas fa-video"></i>';
    }
}

// ২. অডিও মিউট/আনমিউট করা
function toggleAudioMute() {
    const audioTrack = localStream.getAudioTracks()[0];
    const btn = document.getElementById('btn-audio-mute');

    if (audioTrack.enabled) {
        audioTrack.enabled = false; // মিউট
        btn.classList.add('off');
        btn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    } else {
        audioTrack.enabled = true; // আনমিউট
        btn.classList.remove('off');
        btn.innerHTML = '<i class="fas fa-microphone"></i>';
    }
}

// ৩. ক্যামেরা সুইচ (Flip) - Front/Back
let currentFacingMode = 'user'; // user = front, environment = back

async function switchCameraMode() {
    // বর্তমান ট্র্যাক বন্ধ করা
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    // মোড পরিবর্তন
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';

    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode },
            audio: true
        });

        localStream = newStream;
        document.getElementById('local-video').srcObject = newStream;

        // পিসির জন্য বাটন কাজ করবে না কারণ পিসিতে সাধারণত একটাই ক্যামেরা থাকে
        // মোবাইলে এটি ফ্রন্ট/ব্যাক ক্যামেরা সুইচ করবে

        // যদি কল রানিং থাকে, তবে নতুন স্ট্রিম পাঠাতে হবে (Replace Track)
        if (window.currentCall) {
            const videoTrack = newStream.getVideoTracks()[0];
            const sender = window.currentCall.peerConnection.getSenders().find(s => s.track.kind === videoTrack.kind);
            if (sender) {
                sender.replaceTrack(videoTrack);
            }
        }

    } catch (err) {
        console.log("Camera switch error:", err);
        alert("ক্যামেরা সুইচ করা যাচ্ছে না!");
    }
}

// ================= কলিং টাইমার ও এন্ড লজিক =================

let callTimerInterval;
let callSeconds = 0;

// ১. টাইমার শুরু করা
function startCallTimer() {
    const timerDisplay = document.getElementById('call-timer');
    callSeconds = 0;
    timerDisplay.innerText = "00:00";
    
    // আগের টাইমার থাকলে বন্ধ করা
    clearInterval(callTimerInterval);

    callTimerInterval = setInterval(() => {
        callSeconds++;
        const min = Math.floor(callSeconds / 60);
        const sec = callSeconds % 60;
        timerDisplay.innerText = `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec}`;
    }, 1000);
}

// ২. টাইমার বন্ধ করা
function stopCallTimer() {
    clearInterval(callTimerInterval);
    document.getElementById('call-timer').innerText = "00:00";
}

// --- ৩. কল কেটে দিলে (End Call Button) - আপডেটেড ---
function endCall() {
    // ১. সব টাইমার ও সাউন্ড বন্ধ করা
    stopCallTimer();
    if(typeof callRingtone !== 'undefined') {
        callRingtone.pause();
        callRingtone.currentTime = 0;
    }

    // ২. সব স্ক্রিন ও মোডাল জোর করে বন্ধ করা
    const videoScreen = document.getElementById('video-call-screen');
    const incomingModal = document.getElementById('incoming-call-modal');
    
    if(videoScreen) videoScreen.style.display = 'none';
    if(incomingModal) incomingModal.style.display = 'none';

    // ৩. ক্যামেরা ও স্ট্রিম বন্ধ করা
    if (window.localStream) {
        window.localStream.getTracks().forEach(track => track.stop());
        window.localStream = null;
    }
    
    // ৪. পিয়ার কানেকশন বন্ধ করা
    if (window.currentCall) {
        window.currentCall.close();
        window.currentCall = null;
    }

    // ৫. সার্ভারে জানানো (যাতে অপর পক্ষের কলও কাটে)
    if (currentChatFriend) {
        // এখানে আমরা sender/receiver ঠিক করে পাঠাবো
        socket.emit('end_call', { 
            sender: currentUser, 
            receiver: currentChatFriend 
        });
        
        // ইনকামিং কলের নামও ক্লিয়ার করা
        if(window.incomingCaller) {
             socket.emit('end_call', { 
                sender: currentUser, 
                receiver: window.incomingCaller 
            });
            window.incomingCaller = null;
        }
    }
    
    // ৬. কোনো অ্যালার্ট দেখানোর দরকার নেই, সরাসরি বন্ধ হবে
    console.log("Call Ended Locally");
}

// --- ৪. সার্ভার থেকে কল কাটার নির্দেশ আসলে (Both Side End) ---
socket.on('call_ended', (data) => {
    // চেক করা: কলটি কি আমার সাথে সম্পর্কিত?
    if (
        (data.sender === currentChatFriend && data.receiver === currentUser) || 
        (data.sender === currentUser && data.receiver === currentChatFriend) ||
        (data.sender === window.incomingCaller) // ইনকামিং কলার কেটে দিলেও
    ) {
        // ১. অ্যালার্ট বাদ দেওয়া হয়েছে (বিরক্তিকর পপ-আপ বন্ধ)
        // alert("Call Ended"); 
        
        // ২. সব বন্ধ করা
        stopCallTimer();
        if(typeof callRingtone !== 'undefined') {
            callRingtone.pause();
            callRingtone.currentTime = 0;
        }

        const videoScreen = document.getElementById('video-call-screen');
        const incomingModal = document.getElementById('incoming-call-modal');
        
        if(videoScreen) videoScreen.style.display = 'none';
        if(incomingModal) incomingModal.style.display = 'none';
        
        if (window.localStream) {
            window.localStream.getTracks().forEach(track => track.stop());
            window.localStream = null;
        }
        if (window.currentCall) {
            window.currentCall.close();
            window.currentCall = null;
        }
        
        console.log("Call Ended remotely by", data.sender);
    }
});

// --- সময় ফরম্যাট করার ফাংশন (Relative Time) ---
function timeAgo(dateString) {
    const now = new Date();
    const postDate = new Date(dateString);
    const seconds = Math.floor((now - postDate) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + " year" + (interval === 1 ? "" : "s") + " ago";
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + " month" + (interval === 1 ? "" : "s") + " ago";
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
        if(interval === 1) return "Yesterday";
        return interval + " days ago";
    }
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " hour" + (interval === 1 ? "" : "s") + " ago";
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " min" + (interval === 1 ? "" : "s") + " ago";
    
    return "Just now";
}

// ================= ভয়েস মেসেজ সিস্টেম =================

let voiceRecorder = null;
let voiceChunks = [];

// ১. রেকর্ডিং শুরু (চেপে ধরলে)
async function startVoiceRecording() {
    const btn = document.getElementById('voice-record-btn');
    const indicator = document.getElementById('recording-indicator');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        voiceRecorder = new MediaRecorder(stream);
        voiceChunks = [];

        voiceRecorder.ondataavailable = event => {
            voiceChunks.push(event.data);
        };

        voiceRecorder.onstop = sendVoiceMessage; // থামালে সেন্ড হবে

        voiceRecorder.start();
        
        // UI আপডেট
        btn.classList.add('recording-active');
        indicator.style.display = 'block';

    } catch (err) {
        alert("মাইক্রোফোন এক্সেস পাওয়া যায়নি!");
    }
}

// ২. রেকর্ডিং থামা (ছেড়ে দিলে)
function stopVoiceRecording() {
    if (voiceRecorder && voiceRecorder.state === "recording") {
        voiceRecorder.stop();
        
        // স্ট্রিম বন্ধ করা
        voiceRecorder.stream.getTracks().forEach(track => track.stop());
    }

    // UI রিসেট
    document.getElementById('voice-record-btn').classList.remove('recording-active');
    document.getElementById('recording-indicator').style.display = 'none';
}

// ৩. ভয়েস মেসেজ সেন্ড করা
async function sendVoiceMessage() {
    const audioBlob = new Blob(voiceChunks, { type: 'audio/webm' }); // অডিও ফাইল তৈরি
    
    // খুব ছোট রেকর্ডিং হলে বাতিল (ভুল ক্লিক)
    if (audioBlob.size < 1000) return; 

    const formData = new FormData();
    // ফাইলের নাম দিচ্ছি .webm (ব্রাউজারে সাপোর্টেড)
    const fileName = `voice_${Date.now()}.webm`;
    formData.append('chatFile', audioBlob, fileName);

    // আগের আপলোড ফাংশন ব্যবহার করে সার্ভারে পাঠানো
    try {
        const res = await fetch('/chat-upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            const msgData = {
                sender: currentUser,
                receiver: currentChatFriend,
                text: '',
                mediaUrl: data.mediaUrl,
                mediaType: 'audio' // নতুন টাইপ 'audio'
            };
            
            socket.emit('send_message', msgData);
            
            // নিজের বক্সে দেখানো (তবে ডুপ্লিকেট না হয় সেদিকে খেয়াল রাখতে হবে)
            // যেহেতু socket.on এ আমরা appendMessage দিচ্ছি, তাই এখানে আর দরকার নেই
            // appendMessage(msgData, 'my-msg'); 
        }
    } catch (err) {
        console.log("Audio upload failed");
    }
}