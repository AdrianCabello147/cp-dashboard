import { auth } from "./firebase-config.js?v=2026-07-17-production-readiness-ui-v1";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { ensureUserProfile } from "./firestore.js?v=2026-07-17-production-readiness-ui-v1";

onAuthStateChanged(auth, async (user) => {
    console.info("[PSI] Estado de autenticación", {
        authenticated: Boolean(user),
        projectId: auth.app.options.projectId,
        uid: user ? `${user.uid.slice(0, 6)}…` : null,
        appVersion: window.APP_VERSION || "unknown"
    });
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
