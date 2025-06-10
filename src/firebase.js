import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB8D5zB8ZXIeLc9G1qLNZfo7yw7IuTn8og",
    authDomain: "taskbingosweeper.firebaseapp.com",
    projectId: "taskbingosweeper",
    storageBucket: "taskbingosweeper.firebasestorage.app",
    messagingSenderId: "429678416211",
    appId: "1:429678416211:web:a0592c896684bf436911a6",
    measurementId: "G-RFXVY952VR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
