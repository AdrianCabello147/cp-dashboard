import { auth } from "./firebase-config.js?v=2026-07-13-planning-workflow-v6";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { ensureUserProfile } from "./firestore.js?v=2026-07-13-planning-workflow-v6";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userProfile = await ensureUserProfile(user);
        window.currentUserProfile = userProfile;
        document.dispatchEvent(new CustomEvent("user-profile-loaded", {
            detail: userProfile
        }));
        document.body.style.display = "block";
    } else {
        window.currentUserProfile = null;
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
