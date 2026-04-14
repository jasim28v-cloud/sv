// ==================== NEXUS - Script.js ====================

// ========== إعدادات الأدمن ==========
const ADMIN_EMAILS = ['jasim28v@gmail.com', 'jasim77v@gmail.com'];
let isAdmin = false;

// ========== المتغيرات العامة ==========
let currentUser = null;
let currentUserData = null;
let currentPostId = null;
let currentProfileUser = null;
let currentChatUserId = null;
let allUsers = {};
let allPosts = [];
let allBadWords = [];
let isMuted = true;
let isDarkMode = false;
let currentFeed = 'home';
let mediaRecorder = null;
let recordedChunks = [];
let agoraClient = null;
let agoraLocalTrack = null;
let imageViewerImages = [];
let currentImageIndex = 0;
let selectedReportReason = '';
let reportTargetId = null;
let reportTargetType = null;

// ========== دوال المصادقة ==========
function switchAuth(type) {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById(type + 'Form').classList.add('active');
    document.getElementById('loginMsg').innerText = '';
    document.getElementById('regMsg').innerText = '';
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');
    
    if (!email || !password) {
        msg.innerText = 'الرجاء ملء جميع الحقول';
        return;
    }
    
    msg.innerText = 'جاري تسجيل الدخول...';
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        msg.innerText = '';
    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found') msg.innerText = 'لا يوجد حساب بهذا البريد';
        else if (error.code === 'auth/wrong-password') msg.innerText = 'كلمة المرور غير صحيحة';
        else if (error.code === 'auth/invalid-email') msg.innerText = 'البريد الإلكتروني غير صالح';
        else msg.innerText = 'حدث خطأ في تسجيل الدخول';
    }
}

async function register() {
    const username = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;
    const confirmPass = document.getElementById('regConfirmPass').value;
    const msg = document.getElementById('regMsg');
    
    if (!username || !email || !password || !confirmPass) {
        msg.innerText = 'الرجاء ملء جميع الحقول';
        return;
    }
    
    if (username.length < 3) {
        msg.innerText = 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
        return;
    }
    
    if (password.length < 6) {
        msg.innerText = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
        return;
    }
    
    if (password !== confirmPass) {
        msg.innerText = 'كلمتا المرور غير متطابقتين';
        return;
    }
    
    msg.innerText = 'جاري إنشاء الحساب...';
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.ref('users/' + userCredential.user.uid).set({
            username: username,
            email: email,
            bio: '',
            avatarUrl: '',
            coverUrl: '',
            website: '',
            followers: {},
            following: {},
            totalLikes: 0,
            createdAt: Date.now(),
            verified: false,
            role: 'user',
            banned: false
        });
        msg.innerText = '';
    } catch (error) {
        console.error('Register error:', error);
        if (error.code === 'auth/email-already-in-use') msg.innerText = 'البريد الإلكتروني مستخدم بالفعل';
        else if (error.code === 'auth/invalid-email') msg.innerText = 'البريد الإلكتروني غير صالح';
        else msg.innerText = 'حدث خطأ في إنشاء الحساب';
    }
}

function logout() {
    auth.signOut();
    window.location.reload();
}

// ========== التحقق من الأدمن ==========
function checkAdminStatus() {
    if (currentUser && ADMIN_EMAILS.includes(currentUser.email)) {
        isAdmin = true;
        console.log('✅ Admin mode activated for:', currentUser.email);
        return true;
    }
    isAdmin = false;
    return false;
}

// ========== تحميل البيانات ==========
async function loadUserData() {
    const snap = await db.ref('users/' + currentUser.uid).get();
    if (snap.exists()) {
        currentUserData = { uid: currentUser.uid, ...snap.val() };
    }
}

// ✅ تم تعديل هذه الدالة - إضافة uid داخل الكائن
async function loadAllUsers() {
    const snap = await db.ref('users').get();
    allUsers = snap.val() || {};
    // ✅ إصلاح: إضافة الـ uid لكل مستخدم داخل الكائن نفسه
    if (allUsers) {
        Object.keys(allUsers).forEach(uid => {
            allUsers[uid].uid = uid;
        });
    }
}

async function loadBadWords() {
    const snap = await db.ref('badWords').get();
    allBadWords = snap.val() || [];
    if (!Array.isArray(allBadWords)) allBadWords = Object.values(allBadWords);
}

// ========== تحميل المنشورات ==========
function loadPosts() {
    db.ref('posts').on('value', (snap) => {
        const data = snap.val();
        allPosts = [];
        if (data) {
            Object.keys(data).forEach(key => {
                allPosts.push({ id: key, ...data[key] });
            });
            allPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }
        renderFeed();
        updateTrendingSidebar();
    });
}

function renderFeed() {
    const container = document.getElementById('feedContainer');
    if (!container) return;
    
    if (allPosts.length === 0) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><span>لا توجد منشورات بعد</span></div>';
        return;
    }
    
    let html = '';
    allPosts.forEach(post => {
        const user = allUsers[post.userId] || { username: 'مستخدم', avatarUrl: '' };
        const isLiked = post.likes && post.likes[currentUser?.uid];
        const likesCount = post.likes ? Object.keys(post.likes).length : 0;
        const commentsCount = post.comments ? Object.keys(post.comments).length : 0;
        const timeAgo = getTimeAgo(post.timestamp);
        const caption = addHashtags(post.content || '');
        
        html += `
            <div class="post-card fade-in ${post.pinned ? 'pinned' : ''}" data-post-id="${post.id}">
                ${post.pinned ? '<span class="pinned-badge"><i class="fas fa-thumbtack"></i> مثبت</span>' : ''}
                <div class="post-header">
                    <div class="post-user-info" onclick="viewProfile('${post.userId}')">
                        <div class="post-avatar">
                            ${user.avatarUrl ? `<img src="${user.avatarUrl}" alt="">` : `<i class="fas fa-user text-2xl text-white flex items-center justify-center h-full"></i>`}
                        </div>
                        <div>
                            <div class="post-username">
                                @${user.username}
                                ${user.verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}
                            </div>
                            <div class="post-time">${timeAgo}</div>
                        </div>
                    </div>
                    <button class="post-menu" onclick="showPostOptions('${post.id}', '${post.userId}')">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                </div>
                
                <div class="post-caption">
                    ${caption}
                </div>
                
                ${post.mediaUrl ? renderPostMedia(post) : ''}
                ${post.poll ? renderPoll(post.poll) : ''}
                ${post.quotePost ? renderQuotePost(post.quotePost) : ''}
                
                <div class="post-actions">
                    <button class="post-action ${isLiked ? 'active' : ''}" onclick="toggleLike('${post.id}')">
                        <i class="fas fa-heart"></i>
                    </button>
                    <button class="post-action" onclick="openComments('${post.id}')">
                        <i class="fas fa-comment"></i>
                    </button>
                    <button class="post-action" onclick="sharePost('${post.id}')">
                        <i class="fas fa-share"></i>
                    </button>
                    <button class="post-action ${post.saved && post.saved[currentUser?.uid] ? 'active' : ''}" onclick="toggleSavePost('${post.id}')">
                        <i class="fas fa-bookmark"></i>
                    </button>
                </div>
                
                <div class="post-likes" onclick="openLikesList('${post.id}')">
                    ${likesCount} إعجاب
                </div>
                
                ${commentsCount > 0 ? `
                    <div class="post-comments" onclick="openComments('${post.id}')">
                        عرض ${commentsCount} تعليق
                    </div>
                ` : ''}
                
                <div class="post-views">
                    <i class="fas fa-eye"></i> ${post.views || 0} مشاهدة
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderPostMedia(post) {
    if (post.mediaType === 'image') {
        return `
            <div class="px-4 mb-2">
                <img src="${post.mediaUrl}" alt="" class="w-full rounded-xl cursor-pointer" onclick="openImageViewer('${post.mediaUrl}')" style="max-height: 400px; object-fit: cover;">
            </div>
        `;
    } else if (post.mediaType === 'video') {
        return `
            <div class="video-container mx-4 mb-2">
                <video class="post-video" src="${post.mediaUrl}" poster="${post.thumbnail || ''}" onclick="toggleVideoPlay(this)"></video>
                <div class="video-controls">
                    <button onclick="toggleVideoPlay(this.closest('.video-container').querySelector('video'))">
                        <i class="fas fa-play"></i>
                    </button>
                    <button onclick="toggleVideoMute(this.closest('.video-container').querySelector('video'))">
                        <i class="fas fa-volume-mute"></i>
                    </button>
                </div>
            </div>
        `;
    }
    return '';
}

function renderPoll(poll) {
    const totalVotes = Object.values(poll.options).reduce((sum, opt) => sum + (opt.votes || 0), 0);
    let html = '<div class="poll-container">';
    html += `<div class="font-semibold mb-2">${poll.question}</div>`;
    
    Object.entries(poll.options).forEach(([key, opt]) => {
        const percentage = totalVotes > 0 ? ((opt.votes || 0) / totalVotes * 100).toFixed(1) : 0;
        html += `
            <div class="poll-option" onclick="votePoll('${currentPostId}', '${key}')">
                <div class="poll-progress" style="width: ${percentage}%;"></div>
                <div class="poll-option-text">
                    <span>${opt.text}</span>
                    <span>${percentage}% (${opt.votes || 0})</span>
                </div>
            </div>
        `;
    });
    
    html += `<div class="text-xs text-gray-500 mt-2">${totalVotes} صوت</div>`;
    html += '</div>';
    return html;
}

function renderQuotePost(quote) {
    return `
        <div class="quote-post">
            <div class="flex items-center gap-2 mb-1">
                <i class="fas fa-quote-right text-[#6c3ce1]"></i>
                <span class="font-semibold">@${quote.username}</span>
            </div>
            <div class="text-sm">${quote.content}</div>
        </div>
    `;
}

// ========== الهاشتاقات ==========
function addHashtags(text) {
    if (!text) return '';
    return text.replace(/#(\w+)/g, '<span class="post-hashtags" onclick="searchHashtag(\'$1\')">#$1</span>');
}

function searchHashtag(tag) {
    document.getElementById('searchInput').value = '#' + tag;
    openSearch();
    searchAll();
}

// ========== الإعجاب ==========
async function toggleLike(postId) {
    if (!currentUser) return;
    
    const postRef = db.ref('posts/' + postId);
    const snap = await postRef.child('likes').child(currentUser.uid).get();
    
    if (snap.exists()) {
        await postRef.child('likes/' + currentUser.uid).remove();
    } else {
        await postRef.child('likes/' + currentUser.uid).set(true);
        const postSnap = await postRef.get();
        const post = postSnap.val();
        if (post && post.userId !== currentUser.uid) {
            await addNotification(post.userId, 'like', currentUser.uid, postId);
        }
    }
}

// ✅ تم تعديل هذه الدالة - إصلاح مشكلة المتابعة
// ========== المتابعة ==========
async function toggleFollow(userId, btn) {
    if (!currentUser || currentUser.uid === userId) return;
    
    const followingRef = db.ref('users/' + currentUser.uid + '/following/' + userId);
    const followersRef = db.ref('users/' + userId + '/followers/' + currentUser.uid);
    const snap = await followingRef.get();
    
    if (snap.exists()) {
        await followingRef.remove();
        await followersRef.remove();
        if (btn) btn.innerText = 'متابعة';
        if (currentUserData?.following) delete currentUserData.following[userId];
    } else {
        await followingRef.set(true);
        await followersRef.set(true);
        if (btn) btn.innerText = 'متابع';
        if (!currentUserData.following) currentUserData.following = {};
        currentUserData.following[userId] = true;
        await addNotification(userId, 'follow', currentUser.uid);
    }
    
    // ✅ إصلاح: تحديث واجهة الملف الشخصي فوراً
    if (currentProfileUser === userId) {
        await loadProfileData(userId);
    }
    
    // ✅ إصلاح: تحديث قائمة المستخدمين العامة
    await loadAllUsers();
}

// ========== التعليقات ==========
async function openComments(postId) {
    currentPostId = postId;
    const panel = document.getElementById('commentsPanel');
    const container = document.getElementById('commentsList');
    const postRef = db.ref('posts/' + postId);
    
    const snap = await postRef.child('comments').get();
    const comments = snap.val() || {};
    
    container.innerHTML = '';
    const sortedComments = Object.entries(comments).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
    
    sortedComments.forEach(([commentId, comment]) => {
        const user = allUsers[comment.userId] || { username: 'مستخدم', avatarUrl: '' };
        const timeAgo = getTimeAgo(comment.timestamp);
        
        container.innerHTML += `
            <div class="chat-message">
                <div class="post-avatar" style="width: 32px; height: 32px;" onclick="viewProfile('${comment.userId}')">
                    ${user.avatarUrl ? `<img src="${user.avatarUrl}" alt="">` : `<i class="fas fa-user text-white"></i>`}
                </div>
                <div class="message-bubble">
                    <span class="font-semibold cursor-pointer" onclick="viewProfile('${comment.userId}')">@${user.username}</span>
                    <span class="text-sm">${comment.text}</span>
                    <div class="message-status">${timeAgo}</div>
                </div>
            </div>
        `;
    });
    
    if (container.innerHTML === '') {
        container.innerHTML = '<div class="text-center text-gray-400 py-10">لا توجد تعليقات بعد</div>';
    }
    
    panel.classList.add('open');
    
    // زيادة عدد المشاهدات
    const viewsSnap = await postRef.child('views').get();
    const views = (viewsSnap.val() || 0) + 1;
    await postRef.child('views').set(views);
}

function closeComments() {
    document.getElementById('commentsPanel').classList.remove('open');
    currentPostId = null;
}

async function addComment() {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    
    if (!text || !currentPostId) return;
    if (!currentUser) return;
    
    // فحص الكلمات الممنوعة
    if (containsBadWord(text)) {
        showToast('⚠️ تعليقك يحتوي على كلمات غير مسموحة');
        return;
    }
    
    const commentRef = db.ref('posts/' + currentPostId + '/comments').push();
    await commentRef.set({
        userId: currentUser.uid,
        text: text,
        timestamp: Date.now()
    });
    
    input.value = '';
    
    const postSnap = await db.ref('posts/' + currentPostId).get();
    const post = postSnap.val();
    if (post && post.userId !== currentUser.uid) {
        await addNotification(post.userId, 'comment', currentUser.uid, currentPostId);
    }
    
    openComments(currentPostId);
}

// ========== الملف الشخصي ==========
async function viewProfile(userId) {
    if (!userId) return;
    currentProfileUser = userId;
    await loadProfileData(userId);
    document.getElementById('profilePanel').classList.add('open');
}

async function loadProfileData(userId) {
    const userSnap = await db.ref('users/' + userId).get();
    const user = userSnap.val();
    if (!user) return;
    
    document.getElementById('profileName').innerHTML = `
        @${user.username}
        ${user.verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}
    `;
    document.getElementById('profileBio').innerText = user.bio || 'لا توجد سيرة ذاتية';
    document.getElementById('profileWebsite').innerHTML = user.website ? 
        `<i class="fas fa-link"></i> <a href="${user.website}" target="_blank">${user.website}</a>` : '';
    
    const avatarDiv = document.getElementById('profileAvatarLarge');
    if (user.avatarUrl) {
        avatarDiv.innerHTML = `<img src="${user.avatarUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        avatarDiv.innerHTML = `<i class="fas fa-user text-5xl text-white flex items-center justify-center h-full"></i>`;
    }
    
    if (user.coverUrl) {
        document.getElementById('profileCover').style.backgroundImage = `url(${user.coverUrl})`;
    }
    
    const followersCount = user.followers ? Object.keys(user.followers).length : 0;
    const followingCount = user.following ? Object.keys(user.following).length : 0;
    
    document.getElementById('profileFollowersCount').innerText = followersCount;
    document.getElementById('profileFollowingCount').innerText = followingCount;
    
    // حساب عدد المنشورات
    const userPosts = allPosts.filter(p => p.userId === userId);
    document.getElementById('profilePostsCount').innerText = userPosts.length;
    
    // أزرار الملف الشخصي
    const buttonsDiv = document.getElementById('profileButtons');
    if (userId === currentUser?.uid) {
        buttonsDiv.innerHTML = `
            <button class="profile-btn profile-btn-primary" onclick="openEditProfileModal()">
                <i class="fas fa-edit"></i> تعديل الملف
            </button>
            ${isAdmin ? `<button class="profile-btn" onclick="openAdmin()" style="background: #6c3ce1; color: white;">
                <i class="fas fa-shield-alt"></i> لوحة التحكم
            </button>` : ''}
        `;
    } else {
        const isFollowing = currentUserData?.following && currentUserData.following[userId];
        buttonsDiv.innerHTML = `
            <button class="profile-btn profile-btn-primary" onclick="toggleFollow('${userId}', this)">
                ${isFollowing ? 'متابع' : 'متابعة'}
            </button>
            <button class="profile-btn" onclick="openPrivateChat('${userId}')">
                <i class="fas fa-comment"></i> رسالة
            </button>
        `;
    }
    
    // تحميل منشورات الملف الشخصي
    loadProfilePosts(userId);
}

function loadProfilePosts(userId) {
    const grid = document.getElementById('profilePostsGrid');
    const userPosts = allPosts.filter(p => p.userId === userId);
    
    if (userPosts.length === 0) {
        grid.innerHTML = '<div class="col-span-3 text-center text-gray-400 py-10">لا توجد منشورات بعد</div>';
        return;
    }
    
    grid.innerHTML = userPosts.map(post => `
        <div class="grid-item" onclick="openPostFromGrid('${post.id}')">
            ${post.mediaUrl ? 
                (post.mediaType === 'image' ? 
                    `<img src="${post.mediaUrl}" alt="">` : 
                    `<video src="${post.mediaUrl}"></video>`) : 
                '<div class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800"><i class="fas fa-align-left text-2xl"></i></div>'
            }
            <div class="grid-item-overlay">
                <span><i class="fas fa-heart"></i> ${post.likes ? Object.keys(post.likes).length : 0}</span>
                <span><i class="fas fa-comment"></i> ${post.comments ? Object.keys(post.comments).length : 0}</span>
            </div>
        </div>
    `).join('');
}

function loadProfileMedia(userId) {
    const grid = document.getElementById('profilePostsGrid');
    const userPosts = allPosts.filter(p => p.userId === userId && p.mediaUrl);
    
    if (userPosts.length === 0) {
        grid.innerHTML = '<div class="col-span-3 text-center text-gray-400 py-10">لا توجد وسائط</div>';
        return;
    }
    
    grid.innerHTML = userPosts.map(post => `
        <div class="grid-item" onclick="openPostFromGrid('${post.id}')">
            ${post.mediaType === 'image' ? 
                `<img src="${post.mediaUrl}" alt="">` : 
                `<video src="${post.mediaUrl}"></video>`}
        </div>
    `).join('');
}

function openPostFromGrid(postId) {
    closeProfile();
    const post = allPosts.find(p => p.id === postId);
    if (post) {
        currentPostId = postId;
        openComments(postId);
    }
}

function openMyProfile() {
    if (currentUser) {
        viewProfile(currentUser.uid);
    }
}

function closeProfile() {
    document.getElementById('profilePanel').classList.remove('open');
    currentProfileUser = null;
}

// ========== تعديل الملف الشخصي ==========
function openEditProfileModal() {
    document.getElementById('editName').value = currentUserData?.username || '';
    document.getElementById('editBio').value = currentUserData?.bio || '';
    document.getElementById('editWebsite').value = currentUserData?.website || '';
    document.getElementById('editProfileModal').classList.add('open');
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').classList.remove('open');
}

async function saveProfileEdit() {
    const username = document.getElementById('editName').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    const website = document.getElementById('editWebsite').value.trim();
    
    if (!username) {
        showToast('اسم المستخدم مطلوب');
        return;
    }
    
    await db.ref('users/' + currentUser.uid).update({
        username: username,
        bio: bio,
        website: website
    });
    
    currentUserData.username = username;
    currentUserData.bio = bio;
    currentUserData.website = website;
    
    closeEditProfileModal();
    
    if (currentProfileUser === currentUser.uid) {
        await loadProfileData(currentUser.uid);
    }
    
    showToast('✅ تم حفظ التغييرات');
}

// ========== إنشاء منشور ==========
let postMediaFile = null;
let postMediaType = null;

function openCompose() {
    document.getElementById('composeModal').classList.add('open');
    document.getElementById('postText').value = '';
    document.getElementById('mediaPreview').style.display = 'none';
    document.getElementById('mediaPreview').innerHTML = '';
    document.getElementById('pollBuilder').style.display = 'none';
    document.getElementById('schedulePicker').style.display = 'none';
    postMediaFile = null;
    postMediaType = null;
}

function closeCompose() {
    document.getElementById('composeModal').classList.remove('open');
}

function addEmojiToPost(emoji) {
    const textarea = document.getElementById('postText');
    textarea.value += emoji;
    textarea.focus();
}

function openStickerPicker() {
    const picker = document.getElementById('stickerPicker');
    picker.style.display = picker.style.display === 'grid' ? 'none' : 'grid';
}

function addStickerToPost(sticker) {
    addEmojiToPost(sticker);
    document.getElementById('stickerPicker').style.display = 'none';
}

function previewMedia(input, type) {
    const file = input.files[0];
    if (!file) return;
    
    postMediaFile = file;
    postMediaType = type;
    
    const preview = document.getElementById('mediaPreview');
    preview.style.display = 'block';
    
    if (type === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="">`;
        };
        reader.readAsDataURL(file);
    } else if (type === 'video') {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<video src="${e.target.result}" controls></video>`;
        };
        reader.readAsDataURL(file);
    }
}

function addPollToCompose() {
    document.getElementById('pollBuilder').style.display = 'block';
}

function addPollOption() {
    const container = document.getElementById('pollBuilder');
    const optionCount = container.querySelectorAll('input[type="text"]').length - 1;
    if (optionCount < 4) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `خيار ${optionCount + 1}`;
        input.className = 'chat-input';
        input.style.cssText = 'width: 100%; margin-bottom: 4px;';
        container.insertBefore(input, container.lastElementChild);
    }
}

function toggleSchedulePicker() {
    const picker = document.getElementById('schedulePicker');
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}

async function createPost() {
    const text = document.getElementById('postText').value.trim();
    
    if (!text && !postMediaFile) {
        showToast('اكتب منشوراً أو أضف صورة/فيديو');
        return;
    }
    
    if (containsBadWord(text)) {
        showToast('⚠️ منشورك يحتوي على كلمات غير مسموحة');
        return;
    }
    
    const publishBtn = document.getElementById('publishPostBtn');
    publishBtn.disabled = true;
    publishBtn.innerText = 'جاري النشر...';
    
    try {
        let mediaUrl = '';
        let thumbnail = '';
        
        if (postMediaFile) {
            const formData = new FormData();
            formData.append('file', postMediaFile);
            formData.append('upload_preset', UPLOAD_PRESET);
            
            const resourceType = postMediaType === 'image' ? 'image' : 'video';
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            mediaUrl = data.secure_url;
            
            if (postMediaType === 'video') {
                thumbnail = data.secure_url.replace('.mp4', '.jpg');
            }
        }
        
        const postData = {
            userId: currentUser.uid,
            content: text,
            mediaUrl: mediaUrl,
            mediaType: postMediaType,
            thumbnail: thumbnail,
            timestamp: Date.now(),
            likes: {},
            comments: {},
            views: 0,
            pinned: false
        };
        
        // إضافة استطلاع إذا وجد
        const pollQuestion = document.getElementById('pollQuestion')?.value;
        if (pollQuestion) {
            const options = {};
            const optionInputs = document.querySelectorAll('#pollBuilder input[type="text"]');
            for (let i = 1; i < optionInputs.length; i++) {
                if (optionInputs[i].value) {
                    options[`opt${i}`] = { text: optionInputs[i].value, votes: 0 };
                }
            }
            if (Object.keys(options).length >= 2) {
                postData.poll = { question: pollQuestion, options: options };
            }
        }
        
        await db.ref('posts').push(postData);
        
        closeCompose();
        showToast('✅ تم نشر المنشور');
    } catch (error) {
        console.error('Error creating post:', error);
        showToast('❌ فشل نشر المنشور');
    } finally {
        publishBtn.disabled = false;
        publishBtn.innerText = 'مشاركة';
    }
}

// ========== الدردشة الخاصة ==========
async function openConversations() {
    const panel = document.getElementById('conversationsPanel');
    const container = document.getElementById('conversationsList');
    
    const convSnap = await db.ref('private_chats/' + currentUser.uid).get();
    const conversations = convSnap.val() || {};
    
    container.innerHTML = '';
    
    for (const [otherId, conv] of Object.entries(conversations)) {
        const user = allUsers[otherId];
        if (!user) continue;
        
        container.innerHTML += `
            <div class="follower-item" onclick="openPrivateChat('${otherId}')">
                <div class="post-avatar" style="width: 48px; height: 48px;">
                    ${user.avatarUrl ? `<img src="${user.avatarUrl}" alt="">` : `<i class="fas fa-user text-white"></i>`}
                </div>
                <div style="flex: 1;">
                    <div class="font-semibold">@${user.username}</div>
                    <div class="text-sm text-gray-500">${conv.lastMessage || 'ابدأ المحادثة'}</div>
                </div>
            </div>
        `;
    }
    
    if (container.innerHTML === '') {
        container.innerHTML = '<div class="text-center text-gray-400 py-10">لا توجد محادثات بعد</div>';
    }
    
    panel.classList.add('open');
}

function closeConversations() {
    document.getElementById('conversationsPanel').classList.remove('open');
}

async function openPrivateChat(otherUserId) {
    currentChatUserId = otherUserId;
    const user = allUsers[otherUserId];
    
    document.getElementById('chatUserName').innerText = `@${user?.username || 'مستخدم'}`;
    
    const avatarDiv = document.getElementById('chatAvatar');
    if (user?.avatarUrl) {
        avatarDiv.innerHTML = `<img src="${user.avatarUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
        avatarDiv.innerHTML = `<i class="fas fa-user text-white"></i>`;
    }
    
    await loadPrivateMessages(otherUserId);
    document.getElementById('chatPanel').classList.add('open');
    closeConversations();
}

function closeChat() {
    document.getElementById('chatPanel').classList.remove('open');
    currentChatUserId = null;
}

async function loadPrivateMessages(otherUserId) {
    const container = document.getElementById('chatMessages');
    const chatId = getChatId(currentUser.uid, otherUserId);
    
    const snap = await db.ref('private_messages/' + chatId).get();
    const messages = snap.val() || {};
    
    container.innerHTML = '';
    const sortedMessages = Object.entries(messages).sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
    
    sortedMessages.forEach(([msgId, msg]) => {
        const isSent = msg.senderId === currentUser.uid;
        const time = new Date(msg.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        
        container.innerHTML += `
            <div class="chat-message ${isSent ? 'sent' : ''}">
                <div class="message-bubble ${isSent ? 'sent' : ''}">
                    ${msg.type === 'text' ? msg.text : ''}
                    ${msg.type === 'image' ? `<img src="${msg.imageUrl}" class="message-image" onclick="window.open('${msg.imageUrl}')">` : ''}
                    <div class="message-status">${time} ${isSent ? '✓✓' : ''}</div>
                </div>
            </div>
        `;
    });
    
    if (container.innerHTML === '') {
        container.innerHTML = '<div class="text-center text-gray-400 py-10">لا توجد رسائل بعد</div>';
    }
    
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const text = input.value.trim();
    
    if (!text || !currentChatUserId) return;
    
    if (containsBadWord(text)) {
        showToast('⚠️ رسالتك تحتوي على كلمات غير مسموحة');
        return;
    }
    
    const chatId = getChatId(currentUser.uid, currentChatUserId);
    const message = {
        senderId: currentUser.uid,
        text: text,
        type: 'text',
        timestamp: Date.now(),
        read: false
    };
    
    await db.ref('private_messages/' + chatId).push(message);
    
    await db.ref('private_chats/' + currentUser.uid + '/' + currentChatUserId).set({
        lastMessage: text,
        lastTimestamp: Date.now(),
        withUser: currentChatUserId
    });
    
    await db.ref('private_chats/' + currentChatUserId + '/' + currentUser.uid).set({
        lastMessage: text,
        lastTimestamp: Date.now(),
        withUser: currentUser.uid
    });
    
    input.value = '';
    await loadPrivateMessages(currentChatUserId);
}

async function sendChatImage(input) {
    const file = input.files[0];
    if (!file || !currentChatUserId) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    const chatId = getChatId(currentUser.uid, currentChatUserId);
    
    const message = {
        senderId: currentUser.uid,
        imageUrl: data.secure_url,
        type: 'image',
        timestamp: Date.now(),
        read: false
    };
    
    await db.ref('private_messages/' + chatId).push(message);
    
    await db.ref('private_chats/' + currentUser.uid + '/' + currentChatUserId).set({
        lastMessage: '📷 صورة',
        lastTimestamp: Date.now(),
        withUser: currentChatUserId
    });
    
    await db.ref('private_chats/' + currentChatUserId + '/' + currentUser.uid).set({
        lastMessage: '📷 صورة',
        lastTimestamp: Date.now(),
        withUser: currentUser.uid
    });
    
    input.value = '';
    await loadPrivateMessages(currentChatUserId);
}

function onTyping() {
    // يمكن إضافة مؤشر الكتابة هنا
}

function getChatId(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// ========== الإشعارات ==========
async function addNotification(targetUserId, type, fromUserId, postId = null) {
    if (targetUserId === fromUserId) return;
    
    const fromUser = allUsers[fromUserId] || { username: 'مستخدم' };
    const messages = {
        like: 'أعجب بمنشورك',
        comment: 'علق على منشورك',
        follow: 'بدأ بمتابعتك'
    };
    
    await db.ref('notifications/' + targetUserId).push({
        type: type,
        fromUserId: fromUserId,
        fromUsername: fromUser.username,
        message: messages[type],
        postId: postId,
        timestamp: Date.now(),
        read: false
    });
}

async function openNotifications() {
    const panel = document.getElementById('notificationsPanel');
    const container = document.getElementById('notificationsList');
    
    const snap = await db.ref('notifications/' + currentUser.uid).get();
    const notifications = snap.val() || {};
    
    container.innerHTML = '';
    const sortedNotifications = Object.entries(notifications).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
    
    sortedNotifications.forEach(([notifId, notif]) => {
        const timeAgo = getTimeAgo(notif.timestamp);
        const icon = notif.type === 'like' ? '❤️' : notif.type === 'comment' ? '💬' : '👤';
        
        container.innerHTML += `
            <div class="follower-item" onclick="handleNotificationClick('${notif.type}', '${notif.fromUserId}', '${notif.postId || ''}')">
                <div class="text-2xl">${icon}</div>
                <div style="flex: 1;">
                    <div><span class="font-semibold">@${notif.fromUsername}</span> ${notif.message}</div>
                    <div class="text-xs text-gray-500">${timeAgo}</div>
                </div>
                ${!notif.read ? '<div class="w-2 h-2 bg-[#6c3ce1] rounded-full"></div>' : ''}
            </div>
        `;
    });
    
    if (container.innerHTML === '') {
        container.innerHTML = '<div class="text-center text-gray-400 py-10">لا توجد إشعارات</div>';
    }
    
    panel.classList.add('open');
    
    // تحديث حالة القراءة
    Object.entries(notifications).forEach(([id, notif]) => {
        if (!notif.read) {
            db.ref('notifications/' + currentUser.uid + '/' + id + '/read').set(true);
        }
    });
}

function closeNotifications() {
    document.getElementById('notificationsPanel').classList.remove('open');
}

function handleNotificationClick(type, userId, postId) {
    closeNotifications();
    if (type === 'follow') {
        viewProfile(userId);
    } else if (postId) {
        currentPostId = postId;
        openComments(postId);
    }
}

// ========== البحث ==========
function openSearch() {
    document.getElementById('searchPanel').classList.add('open');
    document.getElementById('searchInput').focus();
}

function closeSearch() {
    document.getElementById('searchPanel').classList.remove('open');
}

function searchAll() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const container = document.getElementById('searchResults');
    
    if (!query) {
        container.innerHTML = '<div class="text-center text-gray-400 py-10">اكتب للبحث...</div>';
        return;
    }
    
    const users = Object.values(allUsers).filter(u => 
        u.username?.toLowerCase().includes(query) || 
        u.email?.toLowerCase().includes(query)
    );
    
    const posts = allPosts.filter(p => 
        p.content?.toLowerCase().includes(query)
    );
    
    let html = '';
    
    if (users.length > 0) {
        html += '<div class="font-semibold mb-2">👥 المستخدمين</div>';
        users.slice(0, 5).forEach(user => {
            html += `
                <div class="follower-item" onclick="viewProfile('${user.uid}'); closeSearch();">
                    <div class="post-avatar">
                        ${user.avatarUrl ? `<img src="${user.avatarUrl}" alt="">` : `<i class="fas fa-user text-white"></i>`}
                    </div>
                    <div>
                        <div class="font-semibold">@${user.username}</div>
                        <div class="text-sm text-gray-500">${user.bio || ''}</div>
                    </div>
                </div>
            `;
        });
    }
    
    if (posts.length > 0) {
        html += '<div class="font-semibold mb-2 mt-4">📝 المنشورات</div>';
        posts.slice(0, 5).forEach(post => {
            html += `
                <div class="follower-item" onclick="openPostFromSearch('${post.id}'); closeSearch();">
                    <i class="fas fa-align-left text-xl text-[#6c3ce1]"></i>
                    <div>${post.content?.substring(0, 50)}...</div>
                </div>
            `;
        });
    }
    
    if (html === '') {
        html = '<div class="text-center text-gray-400 py-10">لا توجد نتائج</div>';
    }
    
    container.innerHTML = html;
}

function openPostFromSearch(postId) {
    currentPostId = postId;
    openComments(postId);
}

// ========== المنشورات المحفوظة ==========
async function toggleSavePost(postId) {
    if (!currentUser) return;
    
    const saveRef = db.ref('users/' + currentUser.uid + '/savedPosts/' + postId);
    const snap = await saveRef.get();
    
    if (snap.exists()) {
        await saveRef.remove();
        showToast('تمت إزالة المنشور من المحفوظات');
    } else {
        await saveRef.set(true);
        showToast('✅ تم حفظ المنشور');
    }
}

async function openSavedPosts() {
    const panel = document.getElementById('savedPostsPanel');
    const grid = document.getElementById('savedPostsGrid');
    
    const snap = await db.ref('users/' + currentUser.uid + '/savedPosts').get();
    const saved = snap.val() || {};
    const savedIds = Object.keys(saved);
    
    const savedPosts = allPosts.filter(p => savedIds.includes(p.id));
    
    if (savedPosts.length === 0) {
        grid.innerHTML = '<div class="col-span-3 text-center text-gray-400 py-10">لا توجد منشورات محفوظة</div>';
    } else {
        grid.innerHTML = savedPosts.map(post => `
            <div class="grid-item" onclick="openPostFromGrid('${post.id}'); closeSavedPosts();">
                ${post.mediaUrl ? 
                    (post.mediaType === 'image' ? 
                        `<img src="${post.mediaUrl}" alt="">` : 
                        `<video src="${post.mediaUrl}"></video>`) : 
                    '<div class="flex items-center justify-center h-full bg-gray-100"><i class="fas fa-align-left text-2xl"></i></div>'
                }
            </div>
        `).join('');
    }
    
    panel.classList.add('open');
}

function closeSavedPosts() {
    document.getElementById('savedPostsPanel').classList.remove('open');
}

// ========== المتابعون ==========
async function openFollowersList(type) {
    const panel = document.getElementById('followersPanel');
    const container = document.getElementById('followersList');
    const title = document.getElementById('followersTitle');
    
    const userId = currentProfileUser || currentUser.uid;
    const user = allUsers[userId];
    
    title.innerText = type === 'followers' ? 'المتابعون' : 'يتابع';
    
    const list = type === 'followers' ? user?.followers : user?.following;
    
    container.innerHTML = '';
    
    if (list) {
        for (const uid of Object.keys(list)) {
            const followerUser = allUsers[uid];
            if (followerUser) {
                container.innerHTML += `
                    <div class="follower-item" onclick="viewProfile('${uid}'); closeFollowers();">
                        <div class="post-avatar">
                            ${followerUser.avatarUrl ? `<img src="${followerUser.avatarUrl}" alt="">` : `<i class="fas fa-user text-white"></i>`}
                        </div>
                        <div>
                            <div class="font-semibold">@${followerUser.username}</div>
                            <div class="text-sm text-gray-500">${followerUser.bio || ''}</div>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    if (container.innerHTML === '') {
        container.innerHTML = `<div class="text-center text-gray-400 py-10">لا يوجد ${type === 'followers' ? 'متابعون' : 'متابَعين'}</div>`;
    }
    
    panel.classList.add('open');
}

function closeFollowers() {
    document.getElementById('followersPanel').classList.remove('open');
}

// ========== لوحة التحكم ==========
async function openAdmin() {
    if (!isAdmin) {
        showToast('غير مصرح لك');
        return;
    }
    
    const panel = document.getElementById('adminPanel');
    
    // إحصائيات
    document.getElementById('adminUsersCount').innerText = Object.keys(allUsers).length;
    document.getElementById('adminPostsCount').innerText = allPosts.length;
    
    let commentsCount = 0;
    allPosts.forEach(p => {
        if (p.comments) commentsCount += Object.keys(p.comments).length;
    });
    document.getElementById('adminCommentsCount').innerText = commentsCount;
    
    // تحميل الكلمات الممنوعة
    await loadBadWords();
    renderBadWordsList();
    
    // قائمة المستخدمين
    const usersList = document.getElementById('adminUsersList');
    usersList.innerHTML = Object.values(allUsers).slice(0, 10).map(user => `
        <div class="admin-item">
            <div>
                <div class="font-semibold">@${user.username}</div>
                <div class="text-sm text-gray-500">${user.email}</div>
            </div>
            <div>
                ${user.verified ? '' : `<button class="admin-verify-btn" onclick="verifyUser('${user.uid}')">توثيق</button>`}
                <button class="admin-mute-btn" onclick="toggleMuteUser('${user.uid}')">${user.muted ? 'إلغاء كتم' : 'كتم'}</button>
                <button class="admin-delete-btn" onclick="deleteUser('${user.uid}')">حذف</button>
            </div>
        </div>
    `).join('');
    
    // قائمة المنشورات
    const postsList = document.getElementById('adminPostsList');
    postsList.innerHTML = allPosts.slice(0, 10).map(post => {
        const user = allUsers[post.userId] || { username: 'مستخدم' };
        return `
            <div class="admin-item">
                <div>
                    <div class="font-semibold">@${user.username}</div>
                    <div class="text-sm">${post.content?.substring(0, 50)}...</div>
                </div>
                <div>
                    ${post.pinned ? `<button class="admin-verify-btn" onclick="unpinPost('${post.id}')">إلغاء تثبيت</button>` : `<button class="admin-verify-btn" onclick="pinPost('${post.id}')">تثبيت</button>`}
                    <button class="admin-delete-btn" onclick="deletePost('${post.id}')">حذف</button>
                </div>
            </div>
        `;
    }).join('');
    
    panel.classList.add('open');
}

function closeAdmin() {
    document.getElementById('adminPanel').classList.remove('open');
}

function renderBadWordsList() {
    const container = document.getElementById('badWordsManagerList');
    container.innerHTML = allBadWords.map(word => `
        <span class="bad-word-tag" onclick="removeBadWord('${word}')">
            ${word} <i class="fas fa-times"></i>
        </span>
    `).join('');
}

async function addBadWord() {
    const input = document.getElementById('newBadWordInput');
    const word = input.value.trim().toLowerCase();
    
    if (!word) return;
    if (allBadWords.includes(word)) {
        showToast('الكلمة موجودة مسبقاً');
        return;
    }
    
    allBadWords.push(word);
    await db.ref('badWords').set(allBadWords);
    input.value = '';
    renderBadWordsList();
    showToast('✅ تمت إضافة الكلمة');
}

async function removeBadWord(word) {
    allBadWords = allBadWords.filter(w => w !== word);
    await db.ref('badWords').set(allBadWords);
    renderBadWordsList();
    showToast('✅ تمت إزالة الكلمة');
}

function containsBadWord(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return allBadWords.some(word => lowerText.includes(word.toLowerCase()));
}

// ✅ تم تعديل هذه الدالة - إصلاح مشكلة التوثيق
async function verifyUser(userId) {
    await db.ref('users/' + userId + '/verified').set(true);
    
    // ✅ إصلاح: تحديث البيانات المحلية فوراً
    if (allUsers[userId]) {
        allUsers[userId].verified = true;
    }
    
    // ✅ إصلاح: إذا كان الملف الشخصي للمستخدم الموثّق مفتوحاً، حدّثه
    if (currentProfileUser === userId) {
        await loadProfileData(userId);
    }
    
    // ✅ إصلاح: تحديث المنشورات لإظهار علامة التوثيق
    renderFeed();
    
    showToast('✅ تم توثيق المستخدم');
    openAdmin(); // تحديث لوحة التحكم
}

async function toggleMuteUser(userId) {
    const user = allUsers[userId];
    await db.ref('users/' + userId + '/muted').set(!user.muted);
    allUsers[userId].muted = !user.muted;
    showToast(user.muted ? '✅ تم إلغاء الكتم' : '🔇 تم كتم المستخدم');
    openAdmin();
}

async function deleteUser(userId) {
    if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
        await db.ref('users/' + userId).remove();
        showToast('✅ تم حذف المستخدم');
        openAdmin();
    }
}

async function pinPost(postId) {
    await db.ref('posts/' + postId + '/pinned').set(true);
    showToast('📌 تم تثبيت المنشور');
    openAdmin();
}

async function unpinPost(postId) {
    await db.ref('posts/' + postId + '/pinned').set(false);
    showToast('✅ تم إلغاء التثبيت');
    openAdmin();
}

async function deletePost(postId) {
    if (confirm('هل أنت متأكد من حذف هذا المنشور؟')) {
        await db.ref('posts/' + postId).remove();
        showToast('✅ تم حذف المنشور');
        openAdmin();
    }
}

// ========== التبليغ ==========
function showPostOptions(postId, userId) {
    const options = [
        { text: '📌 حفظ المنشور', action: `toggleSavePost('${postId}')` },
        { text: '📋 نسخ الرابط', action: `copyPostLink('${postId}')` },
    ];
    
    if (userId !== currentUser?.uid) {
        options.push({ text: '🚨 الإبلاغ عن المنشور', action: `openReportModal('${postId}', 'post')` });
    }
    
    if (isAdmin) {
        options.push({ text: '🗑️ حذف المنشور', action: `deletePost('${postId}')` });
    }
    
    // يمكن إضافة قائمة منسدلة هنا
    // للتبسيط سنستخدم confirm
    const choice = confirm('خيارات المنشور:\n1. حفظ\n2. نسخ الرابط\n3. إلغاء');
    if (choice) {
        if (choice === '1') toggleSavePost(postId);
        else if (choice === '2') copyPostLink(postId);
    }
}

function copyPostLink(postId) {
    const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
    navigator.clipboard.writeText(url);
    showToast('📋 تم نسخ الرابط');
}

function openReportModal(targetId, type) {
    reportTargetId = targetId;
    reportTargetType = type;
    document.getElementById('reportModal').classList.add('open');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('open');
    selectedReportReason = '';
    document.querySelectorAll('.report-reason').forEach(el => el.classList.remove('selected'));
}

function selectReportReason(element, reason) {
    document.querySelectorAll('.report-reason').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedReportReason = reason;
}

async function submitReport() {
    if (!selectedReportReason) {
        showToast('الرجاء اختيار سبب الإبلاغ');
        return;
    }
    
    await db.ref('reports').push({
        targetId: reportTargetId,
        targetType: reportTargetType,
        reason: selectedReportReason,
        reporterId: currentUser.uid,
        timestamp: Date.now(),
        status: 'pending'
    });
    
    closeReportModal();
    showToast('✅ تم إرسال البلاغ، شكراً لك');
}

// ========== مشاركة المنشور ==========
function sharePost(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;
    
    const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'منشور من NEXUS',
            text: post.content || 'شاهد هذا المنشور على NEXUS',
            url: url
        });
    } else {
        copyPostLink(postId);
    }
}

// ========== التبديل بين الألسنة ==========
function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    event.target.closest('.nav-item').classList.add('active');
    
    switch(tab) {
        case 'home':
            closeAllPanels();
            renderFeed();
            break;
        case 'search':
            openSearch();
            break;
        case 'notifications':
            openNotifications();
            break;
        case 'profile':
            openMyProfile();
            break;
    }
}

function goToHome() {
    closeAllPanels();
    switchTab('home');
}

function closeAllPanels() {
    document.querySelectorAll('.chat-panel, .modal-overlay, .compose-modal').forEach(p => p.classList.remove('open'));
}

// ========== الثيم ==========
function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    const icon = document.getElementById('themeToggle');
    icon.classList.toggle('fa-moon', !isDarkMode);
    icon.classList.toggle('fa-sun', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);
}

function toggleReadMode() {
    document.getElementById('readModeToggle').classList.toggle('active');
    document.body.classList.toggle('read-mode');
}

function toggleDoNotDisturb() {
    document.getElementById('dndToggle').classList.toggle('active');
    showToast('🔕 وضع عدم الإزعاج ' + (document.getElementById('dndToggle').classList.contains('active') ? 'مفعل' : 'معطل'));
}

function toggleHideLikes() {
    document.getElementById('hideLikesToggle').classList.toggle('active');
    document.body.classList.toggle('hide-likes');
}

// ========== عرض الصور ==========
function openImageViewer(imageUrl) {
    imageViewerImages = [imageUrl];
    currentImageIndex = 0;
    document.getElementById('viewerImage').src = imageUrl;
    document.getElementById('imageViewerModal').classList.add('open');
}

function closeImageViewer() {
    document.getElementById('imageViewerModal').classList.remove('open');
}

function prevImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        document.getElementById('viewerImage').src = imageViewerImages[currentImageIndex];
    }
}

function nextImage() {
    if (currentImageIndex < imageViewerImages.length - 1) {
        currentImageIndex++;
        document.getElementById('viewerImage').src = imageViewerImages[currentImageIndex];
    }
}

// ========== التحكم بالفيديو ==========
function toggleVideoPlay(video) {
    if (video.paused) {
        video.play();
        video.closest('.video-container')?.querySelector('.video-controls .fa-play')?.classList.replace('fa-play', 'fa-pause');
    } else {
        video.pause();
        video.closest('.video-container')?.querySelector('.video-controls .fa-pause')?.classList.replace('fa-pause', 'fa-play');
    }
}

function toggleVideoMute(video) {
    video.muted = !video.muted;
    const icon = video.closest('.video-container')?.querySelector('.video-controls .fa-volume-mute, .fa-volume-up');
    if (icon) {
        icon.classList.toggle('fa-volume-mute', video.muted);
        icon.classList.toggle('fa-volume-up', !video.muted);
    }
}

// ========== الترند ==========
function updateTrendingSidebar() {
    const container = document.getElementById('trendingList');
    if (!container) return;
    
    // استخراج الهاشتاقات الأكثر استخداماً
    const hashtags = {};
    allPosts.forEach(post => {
        const matches = post.content?.match(/#(\w+)/g) || [];
        matches.forEach(tag => {
            hashtags[tag] = (hashtags[tag] || 0) + 1;
        });
    });
    
    const sortedTags = Object.entries(hashtags).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    container.innerHTML = sortedTags.map(([tag, count]) => `
        <div class="trending-item" onclick="searchHashtag('${tag.substring(1)}')">
            <div class="trending-hashtag">${tag}</div>
            <div class="text-sm text-gray-500">${count} منشور</div>
        </div>
    `).join('');
}

// ========== دوال مساعدة ==========
function getTimeAgo(timestamp) {
    if (!timestamp) return 'منذ قليل';
    
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 7) return new Date(timestamp).toLocaleDateString('ar-SA');
    if (days > 0) return `منذ ${days} يوم`;
    if (hours > 0) return `منذ ${hours} ساعة`;
    if (minutes > 0) return `منذ ${minutes} دقيقة`;
    return 'منذ قليل';
}

function showToast(message) {
    const toast = document.getElementById('customToast');
    toast.innerText = message;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

// ========== مراقب المصادقة ==========
auth.onAuthStateChanged(async (user) => {
    document.getElementById('initLoader').style.display = 'flex';
    
    if (user) {
        currentUser = user;
        await loadUserData();
        await loadAllUsers();
        await loadBadWords();
        checkAdminStatus();
        loadPosts();
        
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        // استعادة حالة الثيم
        isDarkMode = localStorage.getItem('darkMode') === 'true';
        document.body.classList.toggle('dark-mode', isDarkMode);
        const themeIcon = document.getElementById('themeToggle');
        if (isDarkMode) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    } else {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
    
    document.getElementById('initLoader').style.display = 'none';
});

// ========== مراقب الرسائل الخاصة ==========
db.ref('private_messages').on('child_added', async (snap) => {
    const chatId = snap.key;
    if (currentChatUserId && chatId === getChatId(currentUser?.uid, currentChatUserId)) {
        await loadPrivateMessages(currentChatUserId);
    }
});

console.log('✅ NEXUS - Script Loaded Successfully');
