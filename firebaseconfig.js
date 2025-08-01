import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-xaGtrczkUCT7rwEOuRnHzVE9AohYsKU",
  authDomain: "bjplivefirebase.firebaseapp.com",
  projectId: "bjplivefirebase",
  storageBucket: "bjplivefirebase.appspot.com",
  messagingSenderId: "236867156337",
  appId: "1:236867156337:web:1fbd6c535689a6f34d5ed0",
  measurementId: "G-M5KY8DW9JD"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
