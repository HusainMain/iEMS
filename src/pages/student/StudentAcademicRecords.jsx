import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '../../services/firebase.config';
import { Loader2, AlertCircle, BookOpen, GraduationCap } from 'lucide-react';

const StudentAcademicRecords = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    
    const [subjects, setSubjects] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({});
    const [enrichedGrades, setEnrichedGrades] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.uid) return;
            try {
                // 1. Fetch Subjects
                if (!user.classId) {
                    setLoading(false);
                    return;
                }
                const subSnap = await getDocs(query(collection(db, 'subjects'), where('classId', '==', user.classId)));
                const subs = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setSubjects(subs);
                
                // 2. Fetch Attendance
                const attSnap = await getDocs(query(collection(db, 'attendance'), where('studentId', '==', user.uid)));
                const attData = attSnap.docs.map(d => d.data());
                
                // Calculate Attendance Stats per subject
                const stats = {};
                subs.forEach(subject => {
                    const subjectRecords = attData.filter(r => r.subjectId === subject.id);
                    const uniqueDates = new Set(subjectRecords.map(r => r.date));
                    const totalSessions = uniqueDates.size;
                    const totalPresent = subjectRecords.filter(r => r.status === 'present').length;
                    
                    const percentage = totalSessions === 0 ? 100 : Math.round((totalPresent / totalSessions) * 100);
                    stats[subject.id] = { percentage, totalSessions, totalPresent };
                });
                setAttendanceStats(stats);
                
                // 3. Fetch Grades
                const gradesSnap = await getDocs(query(collection(db, 'grades'), where('studentId', '==', user.uid)));
                const gradesData = gradesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                
                // 4. Fetch Assessments related to those grades
                const testIds = [...new Set(gradesData.map(g => g.testId))];
                const asmtsData = [];
                // Firestore 'in' query supports max 10 items. We batch if needed.
                for (let i = 0; i < testIds.length; i += 10) {
                    const chunk = testIds.slice(i, i + 10);
                    if (chunk.length > 0) {
                        const asmtSnap = await getDocs(query(collection(db, 'assessments'), where(documentId(), 'in', chunk)));
                        asmtsData.push(...asmtSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                    }
                }
                
                // 5. Enrich Grades
                const enriched = gradesData.map(grade => {
                    const subject = subs.find(s => s.id === grade.subjectId);
                    const assessment = asmtsData.find(a => a.id === grade.testId);
                    
                    const maxMarks = assessment?.maxMarks || 100;
                    const marksObtained = grade.marksObtained || 0;
                    const percentage = Math.round((marksObtained / maxMarks) * 100);
                    
                    return {
                        ...grade,
                        subjectName: subject?.subjectName || 'Unknown Subject',
                        testTitle: assessment?.title || 'Unknown Test',
                        maxMarks,
                        percentage,
                        date: assessment?.createdAt?.toMillis() || grade.timestamp?.toMillis() || 0
                    };
                });
                
                // Sort by date descending
                enriched.sort((a, b) => b.date - a.date);
                setEnrichedGrades(enriched);
                
            } catch (error) {
                console.error("Error fetching academic records:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                <GraduationCap className="w-8 h-8 mr-3 text-blue-600" /> My Academic Records
            </h1>

            {/* Attendance Summary Cards */}
            <div className="mb-10">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-gray-500" /> Attendance Summary
                </h2>
                {subjects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subjects.map(subject => {
                            const stats = attendanceStats[subject.id];
                            if (!stats) return null;
                            const isAtRisk = stats.percentage < 75 && stats.totalSessions > 0;
                            
                            return (
                                <div key={subject.id} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-gray-900">{subject.subjectName}</h3>
                                            <p className="text-sm text-gray-500">{subject.subjectCode}</p>
                                        </div>
                                        {isAtRisk && (
                                            <div className="flex items-center text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold">
                                                <AlertCircle className="w-3 h-3 mr-1" /> At Risk
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-end space-x-2">
                                        <span className={`text-4xl font-black ${isAtRisk ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {stats.percentage}%
                                        </span>
                                        <span className="text-sm text-gray-500 mb-1">
                                            ({stats.totalPresent}/{stats.totalSessions} sessions)
                                        </span>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                                        <div 
                                            className={`h-2 rounded-full ${isAtRisk ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                            style={{ width: `${stats.percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500 italic border border-gray-200">
                        No subjects enrolled yet.
                    </div>
                )}
            </div>

            {/* Grades Table */}
            <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <GraduationCap className="w-5 h-5 mr-2 text-gray-500" /> Grades & Assessments
                </h2>
                
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {enrichedGrades.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase tracking-wider text-xs font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Subject</th>
                                        <th className="px-6 py-4">Test Name</th>
                                        <th className="px-6 py-4 text-center">Marks Obtained</th>
                                        <th className="px-6 py-4 text-center">Max Marks</th>
                                        <th className="px-6 py-4 text-right">Percentage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {enrichedGrades.map((grade) => (
                                        <tr key={grade.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 font-medium text-gray-900">{grade.subjectName}</td>
                                            <td className="px-6 py-4">{grade.testTitle}</td>
                                            <td className="px-6 py-4 text-center font-bold text-blue-700">{grade.marksObtained}</td>
                                            <td className="px-6 py-4 text-center text-gray-500">{grade.maxMarks}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                                                    grade.percentage >= 90 ? 'bg-green-100 text-green-800' :
                                                    grade.percentage >= 75 ? 'bg-blue-100 text-blue-800' :
                                                    grade.percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {grade.percentage}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500 italic border-t border-gray-200">
                            No grades recorded yet. Check back after your tests are graded!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudentAcademicRecords;
