// ==================== NEXUS - Firebase Configuration ====================
const firebaseConfig = {
    apiKey: "AIzaSyBtLujUdKoq1zGb20LSZXG5ogPVqMfhhzg",
    authDomain: "gomka-bc223.firebaseapp.com",
    databaseURL: "https://gomka-bc223-default-rtdb.firebaseio.com/",
    projectId: "gomka-bc223",
    storageBucket: "gomka-bc223.firebasestorage.app",
    appId: "1:355944182113:web:3606605581e4c52239d520"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Services
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

// Cloudinary
const CLOUD_NAME = 'dk9xej3cf';
const UPLOAD_PRESET = 'k30_mk';

// Agora
const AGORA_APP_ID = '4017f66ea15f4ce088e8d8993a072a5b';

// Admin Account
const ADMIN_EMAIL = 'jasim77v@gmail.com';
const ADMIN_PASSWORD = 'mm2314mm';

// Site Name
const SITE_NAME = 'NEXUS';

console.log('✅ NEXUS - Firebase, Cloudinary & Agora Ready');
