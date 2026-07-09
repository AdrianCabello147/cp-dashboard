import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { ensureUserProfile } from "./firestore.js";

const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    loginError.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    console.log("Intentando iniciar sesión con:", email);

    try {
        const credentials = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserProfile(credentials.user);
        console.log("Login correcto");
        window.location.href = "index.html";
    } catch (error) {
        console.error("Error de login:", error);
        loginError.textContent = "Correo o contraseña incorrectos.";
    }
});
