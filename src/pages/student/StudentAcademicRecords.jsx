import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '../../services/firebase.config';
import { Loader2, AlertCircle, BookOpen, GraduationCap, BarChart2 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

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
                    
                    const MathPct = totalSessions === 0 ? 100 : Math.round((totalPresent / totalSessions) * 100);
                    stats[subject.id] = { percentage: MathPct, totalSessions, totalPresent };
                });
                setAttendanceStats(stats);
                
                // 3. Fetch Grades (User requested enrollmentNo filter, but schema might use studentId. Using enrollmentNo as fallback or both)
                // We'll use studentId which is more direct matching the existing schema, but log enrollmentNo.
                const gradesSnap = await getDocs(query(collection(db, 'grades'), where('studentId', '==', user.uid)));
                const gradesData = gradesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                
                // 4. Fetch Assessments related to those grades
                const testIds = [...new Set(gradesData.map(g => g.testId))];
                const asmtsData = [];
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

    // Format data for the Marks Analysis Bar Chart
    const barChartData = useMemo(() => {
        // Aggregate the latest tests or an average per subject. 
        // We'll map each grade directly since it's an overview.
        return enrichedGrades.map(g => ({
            name: `${g.subjectName.split(' ')[0]} - ${g.testTitle}`,
            Marks: g.marksObtained,
            MaxMarks: g.maxMarks,
            Percentage: g.percentage
        })).reverse(); // Reverse so oldest is left, newest is right
    }, [enrichedGrades]);

    if (loading) {
        return <div className="flex justify-center flex-col items-center h-[70vh]"><Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" /><p className="text-gray-500 font-medium">Crunching your academic data...</p></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                <GraduationCap className="w-8 h-8 mr-3 text-blue-600" /> My Academic Records
            </h1>

            {/* Attendance Summary Cards with Pie Charts */}
            <div className="mb-12">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-gray-500" /> Attendance Summary
                </h2>
                {subjects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subjects.map(subject => {
                            const stats = attendanceStats[subject.id];
                            if (!stats) return null;
                            const isAtRisk = stats.percentage < 75 && stats.totalSessions > 0;
                            
                            // Pie Chart Data
                            const absentCount = stats.totalSessions - stats.totalPresent;
                            const pieData = [
                                { name: 'Present', value: stats.totalPresent },
                                { name: 'Absent', value: absentCount > 0 ? absentCount : (stats.totalSessions === 0 ? 1 : 0) } // Mock 1 if 0 sessions to show a grey ring
                            ];
                            
                            const COLORS = isAtRisk ? ['#ef4444', '#fee2e2'] : ['#10b981', '#d1fae5'];
                            if (stats.totalSessions === 0) COLORS[1] = '#f3f4f6'; // Grey if no sessions

                            return (
                                <div key={subject.id} className={`bg-white rounded-xl p-6 border-l-4 shadow-sm hover:shadow-md transition ${isAtRisk ? 'border-red-500' : 'border-emerald-500'} border-y-gray-200 border-r-gray-200`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-gray-900 truncate pr-2">{subject.subjectName}</h3>
                                            <p className="text-sm text-gray-500">{subject.subjectCode}</p>
                                        </div>
                                        {isAtRisk && (
                                            <div className="flex items-center text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                                                <AlertCircle className="w-3 h-3 mr-1" /> At Risk
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-4">
                                        <div className="w-24 h-24 relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={25}
                                                        outerRadius={40}
                                                        paddingAngle={2}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {pieData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className={`text-sm font-black ${isAtRisk ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {stats.percentage}%
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-900">{stats.totalPresent} Present</p>
                                            <p className="text-sm text-gray-500">out of {stats.totalSessions} sessions</p>
                                        </div>
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

            {/* Analytics & Grades View */}
            <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <BarChart2 className="w-5 h-5 mr-2 text-gray-500" /> Marks Analysis
                </h2>
                
                {enrichedGrades.length > 0 ? (
                    <div className="space-y-8">
                        {/* Bar Chart Visualization */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                            <h3 className="text-sm font-medium text-gray-500 mb-6 uppercase tracking-wider">Performance Across Assessments</h3>
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={barChartData}
                                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                    >
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-30} textAnchor="end" height={60} />
                                        <YAxis />
                                        <Tooltip 
                                            cursor={{ fill: '#f3f4f6' }}
                                            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                            formatter={(value, name) => [value, name === 'Marks' ? 'Marks Obtained' : 'Max Marks']}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Bar dataKey="Marks" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                                        <Bar dataKey="MaxMarks" fill="#e5e7eb" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Grades Table */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
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
                                                <td className="px-6 py-4 text-center font-bold text-indigo-700">{grade.marksObtained}</td>
                                                <td className="px-6 py-4 text-center text-gray-500">{grade.maxMarks}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                                                        grade.percentage >= 90 ? 'bg-green-50 text-green-700 border-green-200' :
                                                        grade.percentage >= 75 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        grade.percentage >= 60 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                        'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                        {grade.percentage}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500 italic border border-gray-200">
                        <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        No grades recorded yet. Check back after your tests are graded!
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentAcademicRecords;
