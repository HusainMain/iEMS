import { doc, getDoc, setDoc, collection, addDoc } from "firebase/firestore";
import { db } from "./firebase.config";

export const createUserProfile = async (user) => {
    if (!user) return null;

    console.log("Searching collection 'users' for ID:", user.uid);
    const userRef = doc(db, "users", user.uid);

    try {
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.error("CRITICAL: Document NOT found in 'users' collection for this UID:", user.uid);
            const role = "student"; // Default role if missing

            const newUserData = {
                fullName: user.displayName || user.email.split("@")[0],
                email: user.email,
                role: role,
                createdAt: new Date().toISOString(),
            };

            await setDoc(userRef, newUserData);
            return newUserData;
        }

        const data = userSnap.data();
        data.role = data.role || data.Role || 'student';
        console.log("Raw Firestore Data:", data);
        return data;

    } catch (error) {
        console.log("Firestore Error Details:", error.code, error.message);
        throw error;
    }
};

export const addLog = async (action, userEmail) => {
    try {
        const logsRef = collection(db, "logs");
        await addDoc(logsRef, {
            action,
            userEmail,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error writing system log:", error);
    }
};
