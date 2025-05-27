
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
// We'll conditionally initialize Analytics on the client if needed
// import { getAnalytics, type Analytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCcCpeqQLEti5f6f1v9fbRvOCqnJV2CB00",
  authDomain: "dairy-55516.firebaseapp.com",
  projectId: "dairy-55516",
  storageBucket: "dairy-55516.appspot.com", // Corrected from .firebasestorage.app to .appspot.com
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

// Example of conditionally initializing Analytics (if you decide to use it later)
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
