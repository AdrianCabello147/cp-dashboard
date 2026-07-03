import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJL25kFJOVJ4sJU_hA2gdJwRVuMt-mlDI",
  authDomain: "alte-psi.firebaseapp.com",
  projectId: "alte-psi",
  storageBucket: "alte-psi.firebasestorage.app",
  messagingSenderId: "493660996953",
  appId: "1:493660996953:web:22ec6c8d5403932f4bf848"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };