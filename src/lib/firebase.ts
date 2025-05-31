
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth"; // Added getAuth

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCcCpeqQLEti5f6f1v9fbRvOCqnJV2CB00",
  authDomain: "dairy-55516.firebaseapp.com",
  projectId: "dairy-55516",
  storageBucket: "dairy-55516.appspot.com",
  messagingSenderId: "1093003785749",
  appId: "1:1093003785749:web:29bc2a3deeafa0f43ac01c",
  measurementId: "G-5QTDQH23JP"
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

const auth: Auth = getAuth(app); // Initialize and export Auth
console.log("Firebase Auth instance initialized.");

export { app, db, auth };
