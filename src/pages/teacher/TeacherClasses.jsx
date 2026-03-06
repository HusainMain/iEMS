import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, serverTimestamp, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase.config';
import { Loader2, Upload, FileText, Check, X, Plus, BookOpen, AlertCircle, Trash2, DownloadCloud, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const TeacherClasses = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // Data State
    const [allClasses, setAllClasses] = useState([]);
    const [teacherSubjects, setTeacherSubjects] = useState([]);
    const [enrolledStudents, setEnrolledStudents] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

    // UI State
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [activeTab, setActiveTab] = useState('attendance'); // attendance | announcements | assessments
    const [savingAttendance, setSavingAttendance] = useState({});

    // Assessment / Grading State
    const [assessments, setAssessments] = useState([]);
    const [loadingAssessments, setLoadingAssessments] = useState(false);
    const [selectedAssessment, setSelectedAssessment] = useState(null);
    const [grades, setGrades] = useState({});
    const [savingGrades, setSavingGrades] = useState(false);

    // Announcement Form State
    const [announcementText, setAnnouncementText] = useState('');
    const [announcementFile, setAnnouncementFile] = useState(null);
    const [postingAnnouncement, setPostingAnnouncement] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

    // Assessment Form State
    const [testName, setTestName] = useState('');
    const [maxMarks, setMaxMarks] = useState('');
    const [creatingTest, setCreatingTest] = useState(false);

    // Initial Fetch (Subjects -> Classes)
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.uid) return;
            try {
                const qSubjects = query(collection(db, 'subjects'), where('teacherId', '==', user.uid));
                const subjectSnapshot = await getDocs(qSubjects);
                const subjectsObj = subjectSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setTeacherSubjects(subjectsObj);

                const classSnapshot = await getDocs(collection(db, 'classes'));
                const classesObj = classSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setAllClasses(classesObj);
            } catch (error) {
                console.error("Error fetching classroom data:", error);
                toast.error("Failed to load initial data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    // When Subject changes, fetch enrolled students, attendance, and announcements
    useEffect(() => {
        const fetchSubjectData = async () => {
            if (!selectedSubjectId) {
                setEnrolledStudents([]);
                setAttendanceRecords([]);
                setAnnouncements([]);
                setAssessments([]);
                setSelectedAssessment(null);
                return;
            }
            try {
                // Fetch Students
                const subject = teacherSubjects.find(s => s.id === selectedSubjectId);
                if (subject && subject.enrolledStudents && subject.enrolledStudents.length > 0) {
                    const studentsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
                    const allStudents = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    setEnrolledStudents(allStudents.filter(stu => subject.enrolledStudents.includes(stu.id)));
                } else {
                    setEnrolledStudents([]);
                }

                // Fetch Attendance
                const attSnapshot = await getDocs(query(collection(db, 'attendance'), where('subjectId', '==', selectedSubjectId)));
                setAttendanceRecords(attSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

                // Fetch Announcements
                setLoadingAnnouncements(true);
                const annSnapshot = await getDocs(query(collection(db, 'announcements'), where('subjectId', '==', selectedSubjectId)));
                const annData = annSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                annData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
                setAnnouncements(annData);

                // Fetch Assessments
                setLoadingAssessments(true);
                const asmtSnapshot = await getDocs(query(collection(db, 'assessments'), where('subjectId', '==', selectedSubjectId)));
                const asmtData = asmtSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                asmtData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                setAssessments(asmtData);
            } catch (error) {
                console.error("Error fetching subject data:", error);
                toast.error("Failed to load subject data");
            } finally {
                setLoadingAnnouncements(false);
                setLoadingAssessments(false);
            }
        };
        fetchSubjectData();
    }, [selectedSubjectId, teacherSubjects]);

    // Computed Properties for Dropdowns
    const uniqueClassIds = [...new Set(teacherSubjects.map(s => s.classId))];
    const availableClasses = allClasses.filter(c => uniqueClassIds.includes(c.id));
    const availableSubjects = selectedClassId ? teacherSubjects.filter(s => s.classId === selectedClassId) : [];

    // Check if attendance is tracked today for a student
    const getTodayStatus = (studentId) => {
        const dateStr = new Date().toISOString().split('T')[0];
        const record = attendanceRecords.find(r => r.studentId === studentId && r.date === dateStr);
        return record ? record.status : null;
    };

    // Calculate individual student stats
    const getStudentAttendanceStats = (studentId) => {
        const studentRecords = attendanceRecords.filter(r => r.studentId === studentId);
        const uniqueDates = new Set(attendanceRecords.map(r => r.date));
        const totalSessions = uniqueDates.size === 0 ? 1 : uniqueDates.size;

        const totalPresent = studentRecords.filter(r => r.status === 'present').length;
        const percentage = Math.round((totalPresent / totalSessions) * 100);

        return { percentage: uniqueDates.size === 0 ? 100 : percentage, totalPresent, totalSessions: uniqueDates.size };
    };

    // Class Health Stats
    const totalStudentsCount = enrolledStudents.length;
    const inDangerCount = enrolledStudents.filter(s => {
        const stats = getStudentAttendanceStats(s.id);
        return stats.totalSessions > 0 && stats.percentage < 75;
    }).length;

    // Handlers
    const handleClassChange = (e) => {
        setSelectedClassId(e.target.value);
        setSelectedSubjectId('');
    };

    const handleMarkAttendance = async (studentId, status) => {
        const dateStr = new Date().toISOString().split('T')[0];
        const recordId = `${selectedSubjectId}_${studentId}_${dateStr}`;

        setSavingAttendance(prev => ({ ...prev, [studentId]: status }));
        try {
            const attendanceData = {
                studentId,
                subjectId: selectedSubjectId,
                classId: selectedClassId,
                date: dateStr,
                status: status,
                timestamp: serverTimestamp()
            };

            await setDoc(doc(db, 'attendance', recordId), attendanceData, { merge: true });

            setAttendanceRecords(prev => {
                const existingIndex = prev.findIndex(r => r.id === recordId);
                const newData = { id: recordId, ...attendanceData };
                if (existingIndex > -1) {
                    const newArr = [...prev];
                    newArr[existingIndex] = newData;
                    return newArr;
                }
                return [...prev, newData];
            });

            toast.success(`Marked ${status} for today`);
        } catch (error) {
            console.error("Attendance Error:", error);
            toast.error("Failed to save attendance.");
        } finally {
            setSavingAttendance(prev => {
                const updated = { ...prev };
                delete updated[studentId];
                return updated;
            });
        }
    };

    const handlePostAnnouncement = async (e) => {
        e.preventDefault();
        if (!announcementText.trim() && !announcementFile) return;

        console.log("Starting upload...");

        setPostingAnnouncement(true);
        setUploadProgress('Preparing...');
        try {
            let fileURL = null;
            let fileName = null;

            if (announcementFile) {
                const fileExt = announcementFile.name.split('.').pop().toLowerCase();
                const allowedExts = ['pdf', 'ppt', 'pptx'];
                if (!allowedExts.includes(fileExt)) {
                    toast.error("Invalid format! Only PDFs and PPTs are allowed.");
                    setPostingAnnouncement(false);
                    return;
                }

                setUploadProgress('Uploading file...');
                const fileRef = ref(storage, `announcements/${selectedSubjectId}/${Date.now()}_${announcementFile.name}`);
                const uploadTask = uploadBytesResumable(fileRef, announcementFile);

                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            console.log(`Upload is ${progress}% done`);
                            setUploadProgress(`Uploading: ${Math.round(progress)}%`);
                        }, 
                        (error) => {
                            console.error("Upload failed", error);
                            if (error.code === 'storage/unauthorized') {
                                toast.error("Permission Denied (403): You don't have access to upload.");
                            } else if (error.code === 'storage/object-not-found') {
                                toast.error("Object not found (404).");
                            } else {
                                toast.error(`Upload error: ${error.message}`);
                            }
                            setPostingAnnouncement(false);
                            setUploadProgress('');
                            reject(error);
                        }, 
                        () => {
                            setUploadProgress(null);
                            resolve();
                        }
                    );
                });

                fileURL = await getDownloadURL(uploadTask.snapshot.ref);
                fileName = announcementFile.name;
            }

            setUploadProgress('Saving post...');
            const newDoc = await addDoc(collection(db, 'announcements'), {
                subjectId: selectedSubjectId,
                classId: selectedClassId,
                teacherId: user.uid,
                teacherName: user.fullName || user.email,
                text: announcementText,
                fileURL: fileURL,
                fileName: fileName,
                timestamp: serverTimestamp() // Set by server, we'll mock locally first
            });

            // Optimistic UI update
            const newAnn = {
                id: newDoc.id,
                subjectId: selectedSubjectId,
                classId: selectedClassId,
                teacherId: user.uid,
                teacherName: user.fullName || user.email,
                text: announcementText,
                fileURL: fileURL,
                fileName: fileName,
                timestamp: { toMillis: () => Date.now(), toDate: () => new Date() } // Mock server TS locally
            };

            setAnnouncements(prev => [newAnn, ...prev]);
            setAnnouncementText('');
            setAnnouncementFile(null);
            toast.success("Announcement posted successfully!");
        } catch (error) {
            console.error("Error posting announcement:", error);
            toast.error("Failed to post announcement.");
        } finally {
            setPostingAnnouncement(false);
            setUploadProgress('');
        }
    };

    const handleDeleteAnnouncement = async (id) => {
        if (!window.confirm("Are you sure you want to delete this announcement?")) return;
        try {
            await deleteDoc(doc(db, 'announcements', id));
            setAnnouncements(prev => prev.filter(a => a.id !== id));
            toast.success("Announcement deleted successfully!");
        } catch (error) {
            console.error("Delete Error:", error);
            toast.error("Failed to delete announcement.");
        }
    };

    const handleDeleteTest = async (testId) => {
        if (!window.confirm("Are you sure you want to delete this test? All grades will also be lost.")) return;
        try {
            await deleteDoc(doc(db, 'assessments', testId));
            setAssessments(prev => prev.filter(t => t.id !== testId));
            if (selectedAssessment?.id === testId) {
                setSelectedAssessment(null);
                setGrades({});
            }
            toast.success("Test deleted successfully.");
        } catch (error) {
            console.error("Delete Test Error:", error);
            toast.error("Failed to delete test.");
        }
    };

    const handleCreateTest = async () => {
        console.log("Creating test...");
        
        if (!testName.trim() || !maxMarks) {
            toast("Please provide both Test Name and Max Marks.", { icon: '⚠️' });
            return;
        }

        setCreatingTest(true);
        try {
            const selectedClassObj = availableClasses.find(c => c.id === selectedClassId);
            const academicYear = selectedClassObj?.gradeLevel || 'FY';

            const newAssessment = {
                title: testName,
                maxMarks: Number(maxMarks),
                subjectId: selectedSubjectId,
                classId: selectedClassId,
                year: academicYear,
                teacherId: user.uid,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'assessments'), newAssessment);
            const savedAssessment = { id: docRef.id, ...newAssessment };
            setAssessments(prev => [savedAssessment, ...prev]);

            toast.success("Test created successfully!");
            setTestName('');
            setMaxMarks('');
            setCreatingTest(false);
        } catch (error) {
            console.error("Error creating test:", error);
            toast.error("Failed to create test.");
            setCreatingTest(false);
        }
    };

    const handleSelectAssessment = async (assessment) => {
        setSelectedAssessment(assessment);
        setGrades({});
        
        // Pre-fill existing grades if any
        try {
            const gradesSnapshot = await getDocs(query(
                collection(db, 'grades'), 
                where('testId', '==', assessment.id)
            ));
            
            if (!gradesSnapshot.empty) {
                const existingGrades = {};
                gradesSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    existingGrades[data.studentId] = data.marksObtained;
                });
                setGrades(existingGrades);
            }
        } catch (error) {
            console.error("Error fetching existing grades:", error);
        }
    };

    const handleGradeInputChange = (studentId, value) => {
        if (value === '') {
            setGrades(prev => {
                const newGrades = { ...prev };
                delete newGrades[studentId];
                return newGrades;
            });
            return;
        }

        const numValue = Number(value);
        if (numValue > selectedAssessment.maxMarks) {
            toast.error(`Marks cannot exceed ${selectedAssessment.maxMarks}`);
            return;
        }

        setGrades(prev => ({ ...prev, [studentId]: numValue }));
    };

    const handleSubmitGrades = async () => {
        if (!selectedAssessment) return;
        
        const gradeEntries = Object.entries(grades).filter(([, val]) => val !== undefined && val !== null && val !== '');
        if (gradeEntries.length === 0) {
            toast.error("Please enter marks for at least one student.");
            return;
        }

        setSavingGrades(true);
        try {
            const promises = gradeEntries.map(([studentId, marks]) => {
                const gradeDocId = `${studentId}_${selectedAssessment.id}`;
                return setDoc(doc(db, 'grades', gradeDocId), {
                    studentId,
                    testId: selectedAssessment.id,
                    subjectId: selectedSubjectId,
                    classId: selectedClassId,
                    marksObtained: Number(marks),
                    timestamp: serverTimestamp()
                }, { merge: true });
            });

            await Promise.all(promises);
            toast.success("Marks saved successfully!");
            setSelectedAssessment(null); // Return to list view
        } catch (error) {
            console.error("Error saving grades:", error);
            toast.error("Failed to save some or all grades.");
        } finally {
            setSavingGrades(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Classroom Dashboard</h1>

            {/* Selection Engine */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 items-end">
                <div className="w-full md:w-1/3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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

            {/* Modular Actions UI */}
            {selectedSubjectId ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Sub-Tabs */}
                    <div className="flex border-b border-gray-200 bg-gray-50">
                        {['attendance', 'announcements', 'assessments'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-4 text-sm font-medium text-center capitalize transition-colors ${activeTab === tab
                                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {activeTab === 'attendance' && (
                            <div>
                                {/* Class Health Summary */}
                                <div className="mb-6 flex space-x-4">
                                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex-1 flex items-center justify-between">
                                        <div className="flex items-center text-indigo-700 font-bold">
                                            <Users className="w-5 h-5 mr-2" /> Total Enrolled
                                        </div>
                                        <span className="text-2xl font-black text-indigo-900">{totalStudentsCount}</span>
                                    </div>
                                    <div className={`border p-4 rounded-xl flex-1 flex items-center justify-between ${inDangerCount > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                        <div className={`flex items-center font-bold ${inDangerCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                            {inDangerCount > 0 ? <AlertCircle className="w-5 h-5 mr-2" /> : <Check className="w-5 h-5 mr-2" />} At Risk (&lt; 75%)
                                        </div>
                                        <span className={`text-2xl font-black ${inDangerCount > 0 ? 'text-red-900' : 'text-green-900'}`}>{inDangerCount}</span>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 mb-4">Mark Attendance</h3>
                                {enrolledStudents.length > 0 ? (
                                    <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                                        <li className="p-4 flex items-center justify-between bg-gray-50 font-bold text-gray-600 text-sm uppercase tracking-wider">
                                            <span>Student Name</span>
                                            <div className="flex space-x-12">
                                                <span>Stats</span>
                                                <span>Quick Actions</span>
                                            </div>
                                        </li>
                                        {enrolledStudents.map(student => {
                                            const stats = getStudentAttendanceStats(student.id);
                                            const todayStatus = getTodayStatus(student.id);
                                            const attendancePercentage = stats.percentage;
                                            const isDanger = stats.totalSessions > 0 && attendancePercentage < 75;

                                            return (
                                                <li key={student.id} className={`p-4 flex items-center justify-between hover:bg-gray-50 transition ${isDanger ? 'bg-red-50 hover:bg-red-50' : ''}`}>
                                                    <span className={`font-medium ${isDanger ? 'text-red-900' : 'text-gray-900'}`}>{student.fullName}</span>

                                                    <div className="flex items-center space-x-8">
                                                        {attendancePercentage < 75 && <span className="text-red-500 flex items-center"> <AlertCircle className="w-4 h-4 mr-1" /> At Risk </span>}
                                                        <div className={`text-sm font-bold w-16 text-right ${isDanger ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {stats.percentage}%
                                                        </div>

                                                        <div className="flex space-x-2 w-48 justify-end">
                                                            <button
                                                                onClick={() => handleMarkAttendance(student.id, 'present')}
                                                                disabled={savingAttendance[student.id]}
                                                                className={`px-3 py-1.5 rounded flex items-center justify-center w-24 space-x-1 text-sm border transition-all ${savingAttendance[student.id] === 'present' ? 'bg-gray-100 border-gray-300 text-gray-400 opacity-70' :
                                                                    todayStatus === 'present' ? 'bg-emerald-100 border-emerald-200 text-emerald-800 shadow-sm font-bold' :
                                                                        'bg-white border-gray-200 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                                                                    }`}
                                                            >
                                                                {savingAttendance[student.id] === 'present' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                                <span className="hidden sm:inline">Present</span>
                                                            </button>

                                                            <button
                                                                onClick={() => handleMarkAttendance(student.id, 'absent')}
                                                                disabled={savingAttendance[student.id]}
                                                                className={`px-3 py-1.5 rounded flex items-center justify-center w-24 space-x-1 text-sm border transition-all ${savingAttendance[student.id] === 'absent' ? 'bg-gray-100 border-gray-300 text-gray-400 opacity-70' :
                                                                    todayStatus === 'absent' ? 'bg-red-100 border-red-200 text-red-800 shadow-sm font-bold' :
                                                                        'bg-white border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                                                    }`}
                                                            >
                                                                {savingAttendance[student.id] === 'absent' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                                                <span className="hidden sm:inline">Absent</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500 italic">No students enrolled in this subject.</p>
                                )}
                            </div>
                        )}

                        {activeTab === 'announcements' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Post Announcement / Resource</h3>
                                    <form onSubmit={handlePostAnnouncement} className="space-y-4">
                                        <textarea
                                            rows={4}
                                            required={!announcementFile}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Write your announcement or instructions here..."
                                            value={announcementText}
                                            onChange={(e) => setAnnouncementText(e.target.value)}
                                        />
                                        <div className="flex flex-col space-y-4">
                                            <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                                                <Upload className="w-5 h-5 text-gray-400 mr-2" />
                                                <span className="text-sm text-gray-600 font-medium">
                                                    {announcementFile ? announcementFile.name : 'Upload PDF / PPT Document'}
                                                </span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept=".pdf,.ppt,.pptx"
                                                    onChange={(e) => setAnnouncementFile(e.target.files[0])}
                                                />
                                            </label>

                                            <button
                                                type="submit"
                                                disabled={postingAnnouncement}
                                                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition flex items-center justify-center disabled:bg-blue-300 disabled:cursor-not-allowed"
                                            >
                                                {postingAnnouncement ? (
                                                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {uploadProgress}</>
                                                ) : (
                                                    <><Plus className="w-5 h-5 mr-2" /> Post Item</>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                <div className="border-l border-gray-200 pl-8">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Subject Feed</h3>
                                    {loadingAnnouncements ? (
                                        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                                    ) : announcements.length > 0 ? (
                                        <ul className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                            {announcements.map(ann => (
                                                <li key={ann.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl hover:shadow-sm transition">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">
                                                                {ann.teacherName ? ann.teacherName.charAt(0) : 'T'}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900">{ann.teacherName || 'Teacher'}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {ann.timestamp?.toDate ? new Date(ann.timestamp.toDate()).toLocaleString() : 'Just now'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteAnnouncement(ann.id)}
                                                            className="text-gray-400 hover:text-red-600 transition"
                                                            title="Delete post"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <p className="text-gray-800 text-sm whitespace-pre-wrap">{ann.text}</p>

                                                    {ann.fileURL && (
                                                        <a
                                                            href={ann.fileURL}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="mt-3 flex items-center p-2 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm transition group"
                                                        >
                                                            <DownloadCloud className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                                                            <span className="text-sm font-medium text-blue-700 truncate">{ann.fileName || 'Download Resource'}</span>
                                                        </a>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-500 italic text-center py-10">No announcements found for this subject.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'assessments' && (
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Create Test / Enter Marks</h3>
                                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 flex flex-col items-center justify-center text-center text-gray-500">
                                    <FileText className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                                    <p>Select "Create Test" to build an assessment entry, then input marks for the roster.</p>
                                    
                                    <div className="flex flex-col sm:flex-row w-full max-w-md space-y-2 sm:space-y-0 sm:space-x-2 mt-4 text-left">
                                        <input
                                            type="text"
                                            placeholder="Test Name (e.g., Midterm)"
                                            value={testName}
                                            onChange={(e) => setTestName(e.target.value)}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 text-gray-900 text-sm"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Max Marks"
                                            value={maxMarks}
                                            onChange={(e) => setMaxMarks(e.target.value)}
                                            className="w-full sm:w-28 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 text-gray-900 text-sm"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCreateTest}
                                        disabled={creatingTest}
                                        className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium shadow-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {creatingTest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                        {creatingTest ? "Creating..." : "Create New Test"}
                                    </button>
                                </div>

                                {/* Assessment List & Grading Interface */}
                                <div className="mt-8">
                                    {selectedAssessment ? (
                                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                            <div className="bg-indigo-50 px-6 py-4 flex justify-between items-center border-b border-indigo-100">
                                                <div>
                                                    <h4 className="font-bold text-indigo-900">{selectedAssessment.title}</h4>
                                                    <p className="text-sm text-indigo-700">Max Marks: {selectedAssessment.maxMarks}</p>
                                                </div>
                                                <button 
                                                    onClick={() => setSelectedAssessment(null)}
                                                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition"
                                                >
                                                    Cancel Grading
                                                </button>
                                            </div>
                                            
                                            <div className="p-0 max-h-[500px] overflow-y-auto">
                                                {enrolledStudents.length > 0 ? (
                                                    <table className="w-full text-left text-sm text-gray-600">
                                                        <thead className="text-xs uppercase bg-gray-50 text-gray-700 sticky top-0 border-b border-gray-200 shadow-sm">
                                                            <tr>
                                                                <th className="px-6 py-4 font-bold">Student Name</th>
                                                                <th className="px-6 py-4 font-bold text-right w-48">Marks Obtained</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {enrolledStudents.map(student => (
                                                                <tr key={student.id} className="hover:bg-gray-50 transition">
                                                                    <td className="px-6 py-4 font-medium text-gray-900">{student.fullName}</td>
                                                                    <td className="px-6 py-3 flex justify-end items-center">
                                                                        <div className="flex items-center space-x-2">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                max={selectedAssessment.maxMarks}
                                                                                value={grades[student.id] !== undefined ? grades[student.id] : ''}
                                                                                onChange={(e) => handleGradeInputChange(student.id, e.target.value)}
                                                                                className="w-20 px-3 py-1.5 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 text-right font-medium"
                                                                                placeholder="-"
                                                                            />
                                                                            <span className="text-gray-400 font-medium">/ {selectedAssessment.maxMarks}</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                ) : (
                                                    <p className="p-6 text-gray-500 italic text-center">No students enrolled to grade.</p>
                                                )}
                                            </div>
                                            
                                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                                                <button
                                                    onClick={handleSubmitGrades}
                                                    disabled={savingGrades || Object.keys(grades).length === 0}
                                                    className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {savingGrades ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                                                    {savingGrades ? 'Saving...' : 'Submit Marks'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-4 flex items-center">
                                                <FileText className="w-5 h-5 mr-2 text-gray-400" /> Previous Tests
                                            </h4>
                                            
                                            {loadingAssessments ? (
                                                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                                            ) : assessments.length > 0 ? (
                                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {assessments.map(asmt => (
                                                        <li key={asmt.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:border-blue-200 hover:shadow-sm transition flex justify-between items-center group">
                                                            <div>
                                                                <h5 className="font-bold text-gray-900">{asmt.title}</h5>
                                                                <p className="text-xs text-gray-500 mt-1">Max Marks: {asmt.maxMarks} • {asmt.createdAt?.toDate ? new Date(asmt.createdAt.toDate()).toLocaleDateString() : 'Just now'}</p>
                                                            </div>
                                                            <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition">
                                                                <button
                                                                    onClick={() => handleSelectAssessment(asmt)}
                                                                    className="px-4 py-1.5 bg-blue-50 text-blue-700 font-medium text-sm rounded-md hover:bg-blue-100 transition"
                                                                >
                                                                    Grade
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteTest(asmt.id)}
                                                                    className="px-3 py-1.5 bg-red-50 text-red-600 font-medium rounded-md hover:bg-red-100 transition flex items-center justify-center"
                                                                    title="Delete Test"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="text-center py-8 border border-gray-200 border-dashed rounded-lg bg-gray-50 text-gray-500 text-sm">
                                                    No tests created yet. Create one above to start grading!
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-blue-50 rounded-xl border border-blue-100 p-8 text-center text-blue-800">
                    <BookOpen className="w-12 h-12 mx-auto text-blue-300 mb-3" />
                    <p className="font-medium">Please select a Class and Subject from the dropdowns above to access the classroom controls.</p>
                </div>
            )}
        </div>
    );
};

export default TeacherClasses;
