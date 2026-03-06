/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase.config';
import { createUserProfile } from '../services/db';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    console.log("Fetching Firestore Role for UID...", firebaseUser.uid);

                    let userProfile;

                    // Temporary forced login check for teacher testing
                    if (firebaseUser.email === "teacher@iems.com") {
                        console.log("Bypassing Firestore for teacher account");
                        userProfile = { role: 'teacher', email: firebaseUser.email, fullName: "Prof. Smith" };
                    } else if (firebaseUser.email === "student@iems.com") {
                        console.log("Bypassing Firestore for student account");
                        userProfile = { role: 'student', email: firebaseUser.email, fullName: "John Doe" };
                    } else {
                        userProfile = await createUserProfile(firebaseUser);
                    }

                    console.log("Firestore Role fetch successful:", userProfile);
                    setUser({ ...firebaseUser, ...userProfile });

                    // Hard navigation to bypass React Router loops if stuck on login
                    if (userProfile && (window.location.pathname === '/login' || window.location.pathname === '/')) {
                        window.location.href = userProfile.role === 'admin' ? '/admin/home' : userProfile.role === 'teacher' ? '/teacher/classes' : '/student/grades';
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                    if (error.code === 'permission-denied') {
                        setAuthError("Permission denied fetching user role. Check Firestore Rules in Firebase Console.");
                    } else {
                        setAuthError(`Failed to fetch user profile: ${error.message}`);
                    }
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = useMemo(() => ({
        user,
        loading
    }), [user, loading]);

    return (
        <AuthContext.Provider value={value}>
            {authError ? (
                <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white p-6">
                    <div className="bg-red-900 p-6 rounded-lg max-w-lg border border-red-700">
                        <h2 className="text-xl font-bold text-red-100 mb-2">Authentication Error</h2>
                        <p className="text-red-200">{authError}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 rounded text-white text-sm"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            ) : loading ? (
                <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
                    Initializing iEMS... Checking Firebase Connection...
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
