import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase.config';
import { Loader2, BookOpen, Search, AlertCircle, Users } from 'lucide-react';

const TeacherDashboard = () => {
    const { user } = useAuth();
    
    // Core Data
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [allClasses, setAllClasses] = useState([]);
    const [teacherSubjects, setTeacherSubjects] = useState([]);
    
    // Selection State
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    
    // Subject Data
    const [loadingSubjectData, setLoadingSubjectData] = useState(false);
    const [enrolledStudents, setEnrolledStudents] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [gradesData, setGradesData] = useState([]); // List of grades docs
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    
    // UI State
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch Initial Data
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!user?.uid) return;
            try {
                const qSubjects = query(collection(db, 'subjects'), where('teacherId', '==', user.uid));
                const subjectSnap = await getDocs(qSubjects);
                setTeacherSubjects(subjectSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                const classSnap = await getDocs(collection(db, 'classes'));
                setAllClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Error fetching initial data:", err);
            } finally {
                setLoadingInitial(false);
            }
        };
        fetchInitialData();
    }, [user]);

    // Fetch Subject Data when selected
    useEffect(() => {
        const fetchSubjectData = async () => {
            if (!selectedSubjectId) {
                setEnrolledStudents([]);
                setAssessments([]);
                setGradesData([]);
                setAttendanceRecords([]);
                return;
            }
            
            setLoadingSubjectData(true);
            try {
                const subject = teacherSubjects.find(s => s.id === selectedSubjectId);
                
                // 1. Fetch Students
                let students = [];
                if (subject?.enrolledStudents?.length > 0) {
                    const stuSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
                    const allStu = stuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    students = allStu.filter(stu => subject.enrolledStudents.includes(stu.id));
                }
                setEnrolledStudents(students);

                // 2. Fetch Assessments
                const asmtSnap = await getDocs(query(collection(db, 'assessments'), where('subjectId', '==', selectedSubjectId)));
                const asmts = asmtSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                // Sort by creation date
                asmts.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
                setAssessments(asmts);

                // 3. Fetch Grades
                const gradesSnap = await getDocs(query(collection(db, 'grades'), where('subjectId', '==', selectedSubjectId)));
                setGradesData(gradesSnap.docs.map(d => d.data()));

                // 4. Fetch Attendance
                const attSnap = await getDocs(query(collection(db, 'attendance'), where('subjectId', '==', selectedSubjectId)));
                setAttendanceRecords(attSnap.docs.map(d => d.data()));

            } catch (err) {
                console.error("Error fetching subject data:", err);
            } finally {
                setLoadingSubjectData(false);
            }
        };
        fetchSubjectData();
    }, [selectedSubjectId, teacherSubjects]);

    // Computed Properties for Dropdowns
    const uniqueClassIds = [...new Set(teacherSubjects.map(s => s.classId))];
    const availableClasses = allClasses.filter(c => uniqueClassIds.includes(c.id));
    const availableSubjects = selectedClassId ? teacherSubjects.filter(s => s.classId === selectedClassId) : [];

    // Handlers
    const handleClassChange = (e) => {
        setSelectedClassId(e.target.value);
        setSelectedSubjectId('');
    };

    // Filter students by search query
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return enrolledStudents;
        return enrolledStudents.filter(stu => 
            stu.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            stu.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [enrolledStudents, searchQuery]);

    // Generate Master Gradebook rows
    const gradebookRows = useMemo(() => {
        const uniqueDates = new Set(attendanceRecords.map(r => r.date));
        const totalSessions = uniqueDates.size === 0 ? 1 : uniqueDates.size;

        return filteredStudents.map(student => {
            // Attendance calculation
            const studentAtt = attendanceRecords.filter(r => r.studentId === student.id);
            const totalPresent = studentAtt.filter(r => r.status === 'present').length;
            const attPercentage = uniqueDates.size === 0 ? 100 : Math.round((totalPresent / totalSessions) * 100);

            // Grades extraction
            let totalMarksObtained = 0;
            let totalMaxMarks = 0;
            const studentGradesMap = {};
            
            assessments.forEach(asmt => {
                const gradeRecord = gradesData.find(g => g.studentId === student.id && g.testId === asmt.id);
                if (gradeRecord) {
                    studentGradesMap[asmt.id] = gradeRecord.marksObtained;
                    totalMarksObtained += gradeRecord.marksObtained;
                } else {
                    studentGradesMap[asmt.id] = '-';
                }
                totalMaxMarks += asmt.maxMarks || 0;
            });

            const overallPercentage = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;

            return {
                id: student.id,
                name: student.fullName,
                attPercentage,
                totalSessions: uniqueDates.size,
                gradesMap: studentGradesMap,
                overallPercentage,
                totalMaxMarks
            };
        });
    }, [filteredStudents, attendanceRecords, assessments, gradesData]);

    if (loadingInitial) {
        return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <BookOpen className="w-7 h-7 mr-3 text-indigo-600" /> Master Gradebook
            </h1>

            {/* Selection Engine */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 items-end">
                <div className="w-full md:w-1/3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        value={selectedClassId}
                        onChange={handleClassChange}
                    >
                        <option value="">-- Choose a Class --</option>
                        {availableClasses.map(cls => (
                            <option key={cls.id} value={cls.id}>
                                {cls.className} - {cls.section} ({cls.gradeLevel})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="w-full md:w-1/3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Subject</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        disabled={!selectedClassId}
                    >
                        <option value="">-- Choose a Subject --</option>
                        {availableSubjects.map(sub => (
                            <option key={sub.id} value={sub.id}>
                                {sub.subjectName} ({sub.subjectCode})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Master Gradebook View */}
            {selectedSubjectId ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
                        <h2 className="text-lg font-bold text-gray-800">Class Performance</h2>
                        <div className="relative w-full sm:w-72">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Search student..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="p-0">
                        {loadingSubjectData ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
                        ) : gradebookRows.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-100 text-gray-700 text-xs uppercase font-bold border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 sticky left-0 z-10 bg-gray-100 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Student Name</th>
                                            <th className="px-6 py-4 border-r border-gray-200 text-center">Attendance</th>
                                            {assessments.map(asmt => (
                                                <th key={asmt.id} className="px-6 py-4 border-r border-gray-200 text-center" title={`${asmt.title}\nMax Marks: ${asmt.maxMarks}`}>
                                                    <div className="truncate w-24 mx-auto">{asmt.title}</div>
                                                    <div className="text-[10px] text-gray-500 mt-0.5">/ {asmt.maxMarks}</div>
                                                </th>
                                            ))}
                                            <th className="px-6 py-4 text-right bg-indigo-50 text-indigo-900">Overall Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {gradebookRows.map(row => (
                                            <tr key={row.id} className="hover:bg-gray-50 transition group">
                                                <td className="px-6 py-4 font-bold text-gray-900 sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                    {row.name}
                                                </td>
                                                <td className="px-6 py-4 border-r border-gray-200 text-center">
                                                    {row.totalSessions > 0 ? (
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                                            row.attPercentage < 75 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                                                        }`}>
                                                            {row.attPercentage < 75 && <AlertCircle className="w-3 h-3 mr-1" />}
                                                            {row.attPercentage}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                {assessments.map(asmt => (
                                                    <td key={asmt.id} className="px-6 py-4 border-r border-gray-200 text-center font-medium">
                                                        {row.gradesMap[asmt.id]}
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-right bg-indigo-50/30">
                                                    {row.totalMaxMarks > 0 ? (
                                                        <span className={`font-black ${
                                                            row.overallPercentage >= 80 ? 'text-green-600' :
                                                            row.overallPercentage >= 60 ? 'text-blue-600' :
                                                            row.overallPercentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                                                        }`}>
                                                            {row.overallPercentage}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900">No students enrolled</h3>
                                <p className="text-gray-500 mt-1">There are no students enrolled in this subject yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-10 text-center text-indigo-800">
                    <BookOpen className="w-12 h-12 mx-auto text-indigo-300 mb-4" />
                    <h3 className="text-lg font-bold mb-2">Welcome to your Master Gradebook</h3>
                    <p className="font-medium text-indigo-600/80">Please select a Class and Subject from the dropdowns above to view the comprehensive class performance.</p>
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
