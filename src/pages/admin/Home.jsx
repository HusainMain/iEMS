import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase.config';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { GraduationCap, Users, BookOpen, Loader2, Shield, Calendar, Send, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend } from 'recharts';
import toast from 'react-hot-toast';

const Home = () => {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();

    // Data State
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({ totalClasses: 0, totalTeachers: 0, totalStudents: 0, totalAdmins: 0 });
    const [enrollmentData, setEnrollmentData] = useState([]);
    const [attendanceScore, setAttendanceScore] = useState(0);

    // Broadcast State
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [broadcastType, setBroadcastType] = useState('Info');
    const [sendingBroadcast, setSendingBroadcast] = useState(false);

    useEffect(() => {
        const qClasses = query(collection(db, 'classes'));
        const unsubscribeClasses = onSnapshot(qClasses, (snapClasses) => {
            const classMap = {};
            snapClasses.docs.forEach(d => {
                const data = d.data();
                classMap[d.id] = `${data.className} ${data.section}`;
            });
            setMetrics(prev => ({ ...prev, totalClasses: snapClasses.docs.length }));

            const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
            const unsubscribeStudents = onSnapshot(qStudents, (snapStudents) => {
                setMetrics(prev => ({ ...prev, totalStudents: snapStudents.docs.length }));

                // Calculate Enrollment Breakdown
                const counts = {};
                snapStudents.docs.forEach(doc => {
                    const classId = doc.data().classId;
                    if (classId) {
                        counts[classId] = (counts[classId] || 0) + 1;
                    }
                });

                const formattedEnrollment = Object.keys(counts).map(cId => ({
                    name: classMap[cId] || 'Unknown Class',
                    value: counts[cId]
                }));
                setEnrollmentData(formattedEnrollment);
                checkLoaded(1);
            }, (error) => console.error(error));

            return () => unsubscribeStudents();
        }, (error) => console.error(error));

        const qTeachers = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const unsubscribeTeachers = onSnapshot(qTeachers, (snapshot) => {
            setMetrics(prev => ({ ...prev, totalTeachers: snapshot.docs.length }));
            checkLoaded(2);
        });

        const qAdmins = query(collection(db, 'users'), where('role', '==', 'admin'));
        const unsubscribeAdmins = onSnapshot(qAdmins, (snapshot) => {
            setMetrics(prev => ({ ...prev, totalAdmins: snapshot.docs.length }));
            checkLoaded(3);
        });

        // Calculate Global Attendance Pulse (Mock logic using global attendance docs)
        const qAttendance = query(collection(db, 'attendance'));
        const unsubscribeAttendance = onSnapshot(qAttendance, (snapshot) => {
            let total = 0;
            let present = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.records) {
                    Object.values(data.records).forEach(status => {
                        total++;
                        if (status === 'Present') present++;
                    });
                }
            });
            const score = total > 0 ? Math.round((present / total) * 100) : 100; // Default 100% if no records
            setAttendanceScore(score);
            checkLoaded(4);
        });

        let loadedCount = 0;
        const checkLoaded = () => {
            loadedCount++;
            if (loadedCount >= 4) setLoading(false);
        };

        return () => {
            unsubscribeClasses();
            unsubscribeTeachers();
            unsubscribeAdmins();
            unsubscribeAttendance();
        };
    }, []);

    const handleBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastMsg.trim()) return;

        setSendingBroadcast(true);
        try {
            await addDoc(collection(db, 'global_announcements'), {
                message: broadcastMsg,
                type: broadcastType,
                senderName: currentUser?.fullName || 'System Admin',
                timestamp: new Date().toISOString()
            });
            setBroadcastMsg('');
            toast.success("Broadcast sent to all dashboards!");
        } catch (error) {
            console.error("Broadcast failed:", error);
            toast.error("Failed to send broadcast.");
        } finally {
            setSendingBroadcast(false);
        }
    };

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Institute Situation Room</h1>

            {/* Top Stat Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { title: "Total Students", count: metrics.totalStudents, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
                    { title: "Total Teachers", count: metrics.totalTeachers, icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
                    { title: "Active Classes", count: metrics.totalClasses, icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { title: "System Admins", count: metrics.totalAdmins, icon: Shield, color: "text-purple-600", bg: "bg-purple-50" }
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center space-x-4">
                        <div className={`p-3 rounded-xl ${stat.bg}`}>
                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{stat.title}</p>
                            <h3 className="text-2xl font-black text-gray-900">{stat.count}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Middle Row Left: Charts */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Enrollment Pie Chart */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-gray-800 font-bold mb-4 flex items-center">
                            <Users className="w-5 h-5 mr-2 text-gray-400" /> Enrollment Breakdown
                        </h3>
                        <div className="h-64 w-full">
                            {enrollmentData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={enrollmentData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {enrollmentData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">No enrollment data</div>
                            )}
                        </div>
                    </div>

                    {/* Attendance Pulse */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 bg-green-50 rounded-full p-8 opacity-50">
                            <Activity className="w-24 h-24 text-green-100" />
                        </div>
                        <h3 className="text-gray-800 font-bold text-center w-full z-10">Campus Attendance Pulse</h3>
                        <p className="text-xs text-gray-500 mb-6 text-center z-10 w-full">Today's institute-wide average</p>
                        
                        <div className="relative z-10 flex items-center justify-center">
                            <svg className="w-40 h-40 transform -rotate-90">
                                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-100" />
                                <circle 
                                    cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" 
                                    strokeDasharray={440} strokeDashoffset={440 - (440 * attendanceScore) / 100}
                                    className={`transition-all duration-1000 ease-out ${attendanceScore >= 75 ? 'text-green-500' : attendanceScore >= 50 ? 'text-yellow-500' : 'text-red-500'}`} 
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center">
                                <span className="text-4xl font-black text-gray-800">{attendanceScore}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Middle Row Right: Broadcast & Quick Actions */}
                <div className="space-y-6">
                    {/* Broadcast Messaging */}
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                        <h3 className="text-blue-900 font-bold mb-4 flex items-center">
                            <Send className="w-5 h-5 mr-2 text-blue-500" /> Global Broadcast
                        </h3>
                        <form onSubmit={handleBroadcast} className="space-y-3">
                            <textarea
                                required
                                rows={3}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors text-sm resize-none"
                                placeholder="Write a message to broadcast to all students and staff..."
                                value={broadcastMsg}
                                onChange={(e) => setBroadcastMsg(e.target.value)}
                            />
                            <div className="flex space-x-2">
                                <select 
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-blue-500 focus:bg-white"
                                    value={broadcastType}
                                    onChange={(e) => setBroadcastType(e.target.value)}
                                >
                                    <option value="Info">Info</option>
                                    <option value="Urgent">Urgent</option>
                                    <option value="Event">Event</option>
                                </select>
                                <button
                                    type="submit"
                                    disabled={sendingBroadcast}
                                    className={`flex-1 flex justify-center items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm ${sendingBroadcast ? 'opacity-70' : ''}`}
                                >
                                    {sendingBroadcast ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                    Send to All
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Quick Actions Base */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-gray-800 font-bold mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                            <button onClick={() => navigate('/admin/users', { state: { roleTab: 'students' } })} className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition group">
                                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Manage Students</span>
                                <Users className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                            </button>
                            <button onClick={() => navigate('/admin/academic')} className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition group">
                                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Configure Subjects</span>
                                <BookOpen className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                            </button>
                            <button className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition opacity-60 cursor-not-allowed">
                                <span className="text-sm font-medium text-gray-700">Timetable Master (Soon)</span>
                                <Calendar className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
