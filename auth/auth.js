import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { ensureUserProfile } from "./firestore.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await ensureUserProfile(user);
        document.body.style.display = "block";
    } else {
        window.location.href = "login.html";
    }
});

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "login.html";
    });
}
