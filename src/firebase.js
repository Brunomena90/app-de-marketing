import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDhL8LWQItDmokxBekyqYD2liK7aWk-rag",
    authDomain: "gci-app-9twxq.firebaseapp.com",
    projectId: "gci-app-9twxq",
    storageBucket: "gci-app-9twxq.firebasestorage.app",
    messagingSenderId: "539766146005",
    appId: "1:539766146005:web:df7a4d7723708ea6cef35c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
