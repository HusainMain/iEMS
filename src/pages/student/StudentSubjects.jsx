import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase.config';
import { Loader2, BookOpen, AlertCircle, Calendar, DownloadCloud, FileText, ChevronRight } from 'lucide-react';

const StudentSubjects = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // Data State
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [announcements, setAnnouncements] = useState([]);

    // UI State
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);

    // Fetch Initial Data
    useEffect(() => {
        const fetchStudentData = async () => {
            if (!user?.uid) return;
            try {
                // 1. Fetch Subjects where student is enrolled
                // Note: Students are now enrolled by classId instead of an explicit array
                if (!user.classId) {
                    setLoading(false);
                    return;
                }
                const qSubjects = query(collection(db, 'subjects'), where('classId', '==', user.classId));
                const subjectSnapshot = await getDocs(qSubjects);
                const subjectsObj = subjectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setEnrolledSubjects(subjectsObj);

                // 2. Fetch Announcements for all subjects to calculate the "NEW" badge
                // Since 'in' queries have a limit of 10, and we are just reading recent posts, we can fetch recently or just for all enrolled subjects
                if (subjectsObj.length > 0) {
                    const subjectIds = subjectsObj.map(s => s.id);
                    // For demo, chunk queries if > 10 or fetch all and filter in memory if small DB
                    const annSnapshot = await getDocs(query(collection(db, 'announcements')));
                    const annData = annSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(a => subjectIds.includes(a.subjectId))
                    // .sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());

                    // Sort descending
                    annData.sort((a, b) => {
                        const timeA = a.timestamp?.toMillis() || 0;
                        const timeB = b.timestamp?.toMillis() || 0;
                        return timeB - timeA;
                    });

                    setAnnouncements(annData);
                }

            } catch (error) {
                console.error("Error fetching student data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStudentData();
    }, [user]);

    // Derived Logic
    const isNew = (timestamp) => {
        if (!timestamp) return false;
        const postTime = timestamp.toMillis();
        const now = Date.now();
        const hrs24 = 24 * 60 * 60 * 1000;
        return (now - postTime) < hrs24;
    };

    const hasNewAnnouncements = (subjectId) => {
        return announcements.some(a => a.subjectId === subjectId && isNew(a.timestamp));
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
    }

    if (!selectedSubjectId) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">My Subjects</h1>
                {enrolledSubjects.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100">
                        <p className="text-gray-500">You are not currently enrolled in any subjects.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {enrolledSubjects.map(subject => (
                            <div
                                key={subject.id}
                                onClick={() => setSelectedSubjectId(subject.id)}
                                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-400 transition cursor-pointer relative group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
                                        <BookOpen className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-full">{subject.subjectCode}</span>
                                </div>
                                <h3 className="mt-4 text-lg font-bold text-gray-900 group-hover:text-blue-600 transition">{subject.subjectName}</h3>

                                {hasNewAnnouncements(subject.id) && (
                                    <div className="absolute top-6 right-20 flex items-center bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold shadow-sm animate-pulse">
                                        <AlertCircle className="w-3 h-3 mr-1" /> NEW
                                    </div>
                                )}

                                <div className="mt-6 flex items-center text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition">
                                    View Subject Hub <ChevronRight className="w-4 h-4 ml-1" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Detail View Logic
    const activeSubject = enrolledSubjects.find(s => s.id === selectedSubjectId);
    const subjectAnnouncements = announcements.filter(a => a.subjectId === selectedSubjectId);

    // Mock Data for Progress & Results
    const attendancePercentage = 85;
    const mockTests = [
        { id: 1, name: "Midterm Exam", marks: 85, max: 100 },
        { id: 2, name: "Quiz 1", marks: 18, max: 20 },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <button
                onClick={() => setSelectedSubjectId(null)}
                className="mb-4 flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition"
            >
                ← Back to My Subjects
            </button>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{activeSubject.subjectName}</h1>
                    <p className="text-gray-500">{activeSubject.subjectCode} • Subject Hub</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats & Results */}
                <div className="space-y-8">
                    {/* Attendance Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Attendance Progress</h3>
                        <div className="flex items-end justify-between mb-2">
                            <span className="text-3xl font-extrabold text-gray-900">{attendancePercentage}%</span>
                            <span className="text-sm text-gray-500 font-medium">Present in 17/20 sessions</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                            <div
                                className={`h-3 rounded-full ${attendancePercentage >= 75 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${attendancePercentage}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Test Results Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Academic Records</h3>
                        </div>
                        <ul className="divide-y divide-gray-100">
                            {mockTests.map(test => (
                                <li key={test.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition">
                                    <div className="flex items-center">
                                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                                        <span className="font-medium text-gray-900">{test.name}</span>
                                    </div>
                                    <div className="font-bold text-gray-900">
                                        {test.marks} <span className="text-gray-400 font-medium text-sm">/ {test.max}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Right Column: Announcements */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Announcements & Resources</h3>
                            {hasNewAnnouncements(selectedSubjectId) && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">New Updates</span>
                            )}
                        </div>
                        <div className="p-6 space-y-6">
                            {subjectAnnouncements.length > 0 ? (
                                subjectAnnouncements.map(ann => (
                                    <div key={ann.id} className={`p-4 rounded-xl border ${isNew(ann.timestamp) ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-200'} shadow-sm relative`}>
                                        {isNew(ann.timestamp) && (
                                            <div className="absolute top-4 right-4 text-xs font-bold text-blue-600 flex items-center">
                                                <AlertCircle className="w-3 h-3 mr-1" /> NEW
                                            </div>
                                        )}
                                        <div className="flex items-center space-x-3 mb-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                                {ann.teacherName ? ann.teacherName.charAt(0) : 'T'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{ann.teacherName || 'Teacher'}</p>
                                                <p className="text-xs text-gray-500">
                                                    {ann.timestamp ? new Date(ann.timestamp.toDate()).toLocaleString() : 'Just now'}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{ann.text}</p>

                                        {ann.fileURL && (
                                            <a
                                                href={ann.fileURL}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-4 flex items-center p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition group w-max max-w-full"
                                            >
                                                <DownloadCloud className="w-5 h-5 text-gray-400 group-hover:text-blue-500 mr-3 flex-shrink-0" />
                                                <span className="text-sm font-medium truncate">{ann.fileName || 'Download Attached File'}</span>
                                            </a>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No announcements yet.</p>
                                    <p className="text-sm text-gray-400 mt-1">Check back later for updates from your teacher.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentSubjects;
