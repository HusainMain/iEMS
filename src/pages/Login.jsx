import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase.config';
import { LogIn, AlertCircle } from 'lucide-react';

const Login = () => {
    console.log("Rendering Login Page");
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            console.log("Attempting Login with email...", email);
            await setPersistence(auth, browserLocalPersistence);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("Firebase Auth Success: User UID is...", userCredential.user.uid);
            // AuthContext will handle the fetch of user role and redirect
            // But we can also redirect based on the role here if we wanted to
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Invalid email or password. Please try again.');
            } else {
                setError(`Login Error: ${err.message} (${err.code})`);
            }
        } finally {
            setLoading(false);
        }
    };

    const seedDummyUsers = async () => {
        setLoading(true);
        setError('');
        const dummyUsers = [
            { email: "admin@iems.com", role: "admin", name: "System Admin", pass: "password123" },
            { email: "teacher@iems.com", role: "teacher", name: "Prof. Smith", pass: "password123" },
            { email: "student@iems.com", role: "student", name: "John Doe", pass: "password123" }
        ];

        try {
            for (const u of dummyUsers) {
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, u.email, u.pass);
                    const uid = userCredential.user.uid;

                    await setDoc(doc(db, "users", uid), {
                        email: u.email,
                        role: u.role,
                        fullName: u.name,
                        createdAt: new Date().toISOString()
                    });
                    console.log(`Created ${u.role}: ${u.email}`);
                } catch (err) {
                    if (err.code !== 'auth/email-already-in-use') {
                        throw err;
                    }
                    console.log(`User ${u.email} already exists.`);
                }
            }
            alert("Dummy users seeded successfully! Password is 'password123' for all.");
        } catch (err) {
            console.error(err);
            setError('Failed to seed users: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-blue-500 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div>
                    <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <LogIn className="h-6 w-6 text-blue-600" />
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Sign in to your account
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Welcome to iEMS Platform
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    {error && (
                        <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                            <AlertCircle className="h-5 w-5" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <div className="rounded-md shadow-sm space-y-4">
                        <div>
                            <label htmlFor="email-address" className="sr-only">Email address</label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </div>

                    {import.meta.env.DEV && (
                        <div className="pt-4 border-t border-gray-200 text-center">
                            <button
                                type="button"
                                onClick={seedDummyUsers}
                                disabled={loading}
                                className="text-sm text-gray-500 hover:text-blue-600 focus:outline-none underline"
                            >
                                (Dev Only) Seed Dummy Users
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/admin/home')}
                                className="mt-4 text-sm text-red-500 hover:text-red-600 focus:outline-none underline block w-full"
                            >
                                (Emergency) Bypass to Admin Dashboard
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default Login;
