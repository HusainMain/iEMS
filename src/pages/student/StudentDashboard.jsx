import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase.config';
import { Loader2, BookOpen, Clock, FileText, DownloadCloud, FileIcon, MessageSquare } from 'lucide-react';

const StudentDashboard = () => {
    const { user } = useAuth();
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
    const [announcements, setAnnouncements] = useState([]);

    // 1. Fetch Subjects Student is Enrolled In
    useEffect(() => {
        const fetchSubjects = async () => {
            if (!user?.uid) return;
            try {
                const q = query(collection(db, 'subjects'), where('enrolledStudents', 'array-contains', user.uid));
                const snapshot = await getDocs(q);
                const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSubjects(subs);
                
                if (subs.length > 0) {
                    setSelectedSubjectId(subs[0].id); // Auto-select first subject
                }
            } catch (err) {
                console.error("Error fetching subjects:", err);
            } finally {
                setLoadingSubjects(false);
            }
        };

        fetchSubjects();
    }, [user]);

    // 2. Fetch Announcements for Selected Subject
    useEffect(() => {
        const fetchAnnouncements = async () => {
            if (!selectedSubjectId) return;
            
            setLoadingAnnouncements(true);
            try {
                // Firebase might require a composite index for where+orderBy. 
                // We'll fetch by where() and sort locally to be safe.
                const q = query(
                    collection(db, 'announcements'), 
                    where('subjectId', '==', selectedSubjectId)
                );
                const snapshot = await getDocs(q);
                
                const anns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Sort descending by timestamp
                anns.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
                
                setAnnouncements(anns);
            } catch (err) {
                console.error("Error fetching announcements:", err);
            } finally {
                setLoadingAnnouncements(false);
            }
        };

        fetchAnnouncements();
    }, [selectedSubjectId]);

    // Helpers
    const getFileIcon = (fileName) => {
        if (!fileName) return <FileIcon className="w-5 h-5 text-gray-500" />;
        const ext = fileName.split('.').pop().toLowerCase();
        if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
        if (['ppt', 'pptx'].includes(ext)) return <FileText className="w-5 h-5 text-orange-500" />;
        return <FileIcon className="w-5 h-5 text-blue-500" />;
    };

    if (loadingSubjects) {
        return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Header & Subject Selection */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                        <MessageSquare className="w-8 h-8 mr-3 text-indigo-600" /> Class Updates Feed
                    </h1>
                    <p className="text-gray-600 mt-1">Stay up to date with announcements and materials from your teachers.</p>
                </div>

                <div className="w-full md:w-72 bg-white rounded-xl shadow-sm border border-gray-200 p-2">
                    <label className="sr-only">Select Subject</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <BookOpen className="h-5 w-5 text-indigo-400" />
                        </div>
                        <select
                            className="block w-full pl-10 pr-3 py-2 border-transparent bg-transparent text-gray-900 font-medium focus:ring-0 focus:border-transparent sm:text-sm cursor-pointer"
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(e.target.value)}
                        >
                            <option value="" disabled>-- Choose a Subject --</option>
                            {subjects.map(sub => (
                                <option key={sub.id} value={sub.id}>
                                    {sub.subjectName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Feed Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 min-h-[500px] overflow-hidden">
                {!selectedSubjectId ? (
                    <div className="flex flex-col items-center justify-center p-20 text-gray-500">
                        <BookOpen className="w-16 h-16 text-gray-200 mb-4" />
                        <h3 className="text-xl font-medium text-gray-700">No Subject Selected</h3>
                        <p className="mt-2 text-center">Please select a subject from the dropdown to view its feed.</p>
                    </div>
                ) : loadingAnnouncements ? (
                    <div className="flex justify-center p-20">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-300" />
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-gray-500">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                            <MessageSquare className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-xl font-medium text-gray-700">All caught up!</h3>
                        <p className="mt-2 text-center max-w-md">There are no announcements posted by the teacher for this subject yet.</p>
                    </div>
                ) : (
                    <div className="p-6 sm:p-8 border-l-2 border-indigo-100 ml-4 sm:ml-8 my-8 relative">
                        <div className="space-y-12">
                            {announcements.map((ann, idx) => {
                                const date = ann.timestamp?.toDate ? new Date(ann.timestamp.toDate()) : new Date();
                                const dateString = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                                const timeString = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

                                return (
                                    <div key={ann.id || idx} className="relative group">
                                        {/* Timeline Dot */}
                                        <div className="absolute -left-[45px] sm:-left-[61px] top-1 mt-1.5 w-6 h-6 bg-indigo-100 border-4 border-white rounded-full flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110">
                                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                        </div>

                                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                                            {/* Post Header */}
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700 flex items-center justify-center font-bold text-lg shadow-inner">
                                                        {ann.teacherName ? ann.teacherName.charAt(0).toUpperCase() : 'T'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">{ann.teacherName || 'Teacher'}</p>
                                                        <div className="flex items-center text-xs text-gray-500 font-medium">
                                                            <Clock className="w-3.5 h-3.5 mr-1" />
                                                            {dateString} at {timeString}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Post Body */}
                                            <div className="prose prose-sm max-w-none text-gray-800 mb-4 whitespace-pre-wrap">
                                                {ann.text}
                                            </div>

                                            {/* Attachment */}
                                            {ann.fileURL && (
                                                <div className="mt-5 border-t border-gray-100 pt-4">
                                                    <a 
                                                        href={ann.fileURL} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors group/btn max-w-full"
                                                    >
                                                        <div className="p-2 bg-white rounded-lg shadow-sm mr-3">
                                                            {getFileIcon(ann.fileName)}
                                                        </div>
                                                        <div className="flex-1 min-w-0 mr-4">
                                                            <p className="text-sm font-bold text-gray-900 truncate">{ann.fileName || 'Download Resource'}</p>
                                                            <p className="text-xs font-medium text-indigo-600 mt-0.5">Click to view attachment</p>
                                                        </div>
                                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 group-hover/btn:bg-indigo-600 group-hover/btn:text-white transition-colors group-hover/btn:border-transparent">
                                                            <DownloadCloud className="w-4 h-4 text-gray-400 group-hover/btn:text-white" />
                                                        </div>
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentDashboard;
