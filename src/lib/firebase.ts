// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getFirestore, type Firestore } from "firebase/firestore"; // Import Firestore

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY", // MAKE SURE TO REPLACE THIS
  authDomain: "YOUR_ACTUAL_AUTH_DOMAIN", // MAKE SURE TO REPLACE THIS
  projectId: "YOUR_ACTUAL_PROJECT_ID", // MAKE SURE TO REPLACE THIS
  storageBucket: "YOUR_ACTUAL_STORAGE_BUCKET", // MAKE SURE TO REPLACE THIS
  messagingSenderId: "YOUR_ACTUAL_MESSAGING_SENDER_ID", // MAKE SURE TO REPLACE THIS
  appId: "YOUR_ACTUAL_APP_ID", // MAKE SURE TO REPLACE THIS
  measurementId: "YOUR_ACTUAL_MEASUREMENT_ID" // Optional, but replace if you have it
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
const analytics: Analytics = getAnalytics(app);
const db: Firestore = getFirestore(app); // Initialize Firestore

// Export the instances you'll need
export { app, db, analytics };
