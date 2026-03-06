import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase.config';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Users, BookOpen, Loader2, Shield } from 'lucide-react';

const Home = () => {
    const [metrics, setMetrics] = useState({
        totalClasses: 0,
        totalTeachers: 0,
        totalStudents: 0,
        totalAdmins: 0
    });
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const qClasses = query(collection(db, 'classes'));
        const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
            setMetrics(prev => ({ ...prev, totalClasses: snapshot.docs.length }));
            checkLoaded(1);
        }, (error) => console.error("Error fetching classes:", error));

        const qTeachers = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const unsubscribeTeachers = onSnapshot(qTeachers, (snapshot) => {
            setMetrics(prev => ({ ...prev, totalTeachers: snapshot.docs.length }));
            checkLoaded(2);
        }, (error) => console.error("Error fetching teachers:", error));

        const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
        const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
            setMetrics(prev => ({ ...prev, totalStudents: snapshot.docs.length }));
            checkLoaded(3);
        }, (error) => console.error("Error fetching students:", error));

        const qAdmins = query(collection(db, 'users'), where('role', '==', 'admin'));
        const unsubscribeAdmins = onSnapshot(qAdmins, (snapshot) => {
            setMetrics(prev => ({ ...prev, totalAdmins: snapshot.docs.length }));
            checkLoaded(4);
        }, (error) => console.error("Error fetching admins:", error));

        let loadedCount = 0;
        const checkLoaded = () => {
            loadedCount++;
            if (loadedCount === 4) {
                setLoading(false);
            }
        };

        return () => {
            unsubscribeClasses();
            unsubscribeTeachers();
            unsubscribeStudents();
            unsubscribeAdmins();
        };
    }, []);

    const MetricCard = ({ title, count, icon, onClick, colorClass, bgColorClass }) => (
        <div
            onClick={onClick}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4 cursor-pointer hover:shadow-md transition-shadow duration-200 transform hover:-translate-y-1"
        >
            <div className={`p-4 rounded-lg ${bgColorClass}`}>
                {React.createElement(icon, { className: `w-8 h-8 ${colorClass}` })}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <h3 className="text-3xl font-bold text-gray-900">{count}</h3>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-8">Admin Dashboard Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    title="Total Classes"
                    count={metrics.totalClasses}
                    icon={GraduationCap}
                    onClick={() => navigate('/admin/academic')}
                    colorClass="text-emerald-600"
                    bgColorClass="bg-emerald-50"
                />

                <MetricCard
                    title="Total Teachers"
                    count={metrics.totalTeachers}
                    icon={BookOpen}
                    onClick={() => navigate('/admin/users', { state: { roleTab: 'teachers' } })}
                    colorClass="text-indigo-600"
                    bgColorClass="bg-indigo-50"
                />

                <MetricCard
                    title="Total Students"
                    count={metrics.totalStudents}
                    icon={Users}
                    onClick={() => navigate('/admin/users', { state: { roleTab: 'students' } })}
                    colorClass="text-blue-600"
                    bgColorClass="bg-blue-50"
                />

                <MetricCard
                    title="Total Admins"
                    count={metrics.totalAdmins}
                    icon={Shield}
                    onClick={() => navigate('/admin/users', { state: { roleTab: 'admins' } })}
                    colorClass="text-purple-600"
                    bgColorClass="bg-purple-50"
                />
            </div>
        </div>
    );
};

export default Home;
