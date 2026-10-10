// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAWF2Ygkug8b-84gtDkFRPa-yujsC0vwQM",
  authDomain: "stock-monitor-app-e997a.firebaseapp.com",
  projectId: "stock-monitor-app-e997a",
  storageBucket: "stock-monitor-app-e997a.firebasestorage.app",
  messagingSenderId: "768920851748",
  appId: "1:768920851748:web:2f9b9a125ff9b6e33b0fb1",
  measurementId: "G-56889L2JNF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export Auth และ Firestore สำหรับใช้งานในระบบพอร์ตหุ้น
export const auth = getAuth(app);
export const db = getFirestore(app);