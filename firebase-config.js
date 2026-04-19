import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAjSLp9bkzKz71GytZU1Jz5bQoNMKB5Fxo",
    authDomain: "worklink-5384c.firebaseapp.com",
    databaseURL: "https://worklink-5384c-default-rtdb.firebaseio.com/",
    projectId: "worklink-5384c",
    storageBucket: "worklink-5384c.firebasestorage.app",
    appId: "1:582114312352:web:08dea19f81f35abfe649c5"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app); // Обязательно export!
