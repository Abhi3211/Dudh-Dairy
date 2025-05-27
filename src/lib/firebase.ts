
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
// import { getAnalytics, type Analytics, isSupported } from "firebase/analytics"; // We'll add Analytics later if needed

// Your web app's Firebase configuration
// IMPORTANT: Replace these with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_ACTUAL_AUTH_DOMAIN",
  projectId: "YOUR_ACTUAL_PROJECT_ID",
  storageBucket: "YOUR_ACTUAL_STORAGE_BUCKET",
  messagingSenderId: "YOUR_ACTUAL_MESSAGING_SENDER_ID",
  appId: "YOUR_ACTUAL_APP_ID"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("Firebase app initialized successfully.");
} else {
  app = getApps()[0];
  console.log("Firebase app already initialized.");
}

const db: Firestore = getFirestore(app);
console.log("Firestore db instance initialized.");

// We can add Analytics initialization here later if needed, ensuring it only runs on the client
// let analytics: Analytics | undefined;
// if (typeof window !== 'undefined') {
//   isSupported().then((supported) => {
//     if (supported) {
//       analytics = getAnalytics(app);
//       console.log("Firebase Analytics initialized.");
//     }
//   });
// }

export { app, db };
