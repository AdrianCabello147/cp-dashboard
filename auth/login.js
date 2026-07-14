import { auth } from "./firebase-config.js?v=2026-07-14-planning-weekly-admin-cache-v1";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { ensureUserProfile } from "./firestore.js?v=2026-07-14-planning-weekly-admin-cache-v1";

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
