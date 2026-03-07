import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc, where, getDocs, writeBatch, arrayUnion } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../../services/firebase.config';
import { addLog } from '../../services/db';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Plus, X, AlertCircle, Edit, Trash2, BookOpen, GraduationCap, ChevronDown, ChevronRight, Clock, Upload, FileText } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

const AdminDashboard = ({ defaultTab = 'users' }) => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    const [activeTab, setActiveTab] = useState(defaultTab);
    const [activeRoleTab, setActiveRoleTab] = useState('students');

    // Sync tab with prop and location state
    useEffect(() => {
        setActiveTab(defaultTab);
        if (location.state?.roleTab) {
            setActiveRoleTab(location.state.roleTab);
        }
    }, [defaultTab, location]);

    // Log view access
    useEffect(() => {
        if (currentUser?.email) {
            if (activeTab === 'users') {
                addLog('Admin accessed User Management', currentUser.email);
            } else if (activeTab === 'subjects') {
                addLog('Admin viewed Academic Overview', currentUser.email);
            }
        }
    }, [activeTab, currentUser]);

    const [subjects, setSubjects] = useState([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [classesData, setClassesData] = useState([]);
    const [expandedClasses, setExpandedClasses] = useState(new Set());

    const toggleClass = (classId) => {
        const newExpanded = new Set(expandedClasses);
        if (newExpanded.has(classId)) {
            newExpanded.delete(classId);
        } else {
            newExpanded.add(classId);
        }
        setExpandedClasses(newExpanded);
    };

    // Modal State - User
    const [showModal, setShowModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [loadingCreate, setLoadingCreate] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        role: 'student',
        classId: '',
        batch: 'All'
    });

    // Modal State - Subject
    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [isEditingSubject, setIsEditingSubject] = useState(false);
    const [editingSubjectId, setEditingSubjectId] = useState(null);
    const [subjectData, setSubjectData] = useState({
        subjectName: '',
        subjectCode: '',
        teacherId: '',
        classId: '',
        schedule: [] // Array of { day, startTime, endTime, batch, room }
    });

    // Modal State - Class
    const [showClassModal, setShowClassModal] = useState(false);
    const [classForm, setClassForm] = useState({ className: '', section: '', gradeLevel: '' });

    // Modal State - Delete
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, type: null, data: null });

    useEffect(() => {
        const qUsers = query(collection(db, 'users'));
        const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching users:", error);
            setLoading(false);
        });

        const qSubjects = query(collection(db, 'subjects'));
        const unsubscribeSubjects = onSnapshot(qSubjects, (snapshot) => {
            const subjectsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setSubjects(subjectsData);
            setLoadingSubjects(false);
        }, (error) => {
            console.error("Error fetching subjects:", error);
            setLoadingSubjects(false);
        });

        const qClasses = query(collection(db, 'classes'));
        const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setClassesData(data);
        }, (error) => {
            console.error("Error fetching classes:", error);
        });

        return () => {
            unsubscribeUsers();
            unsubscribeSubjects();
            unsubscribeClasses();
        };
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setLoadingCreate(true);
        setError('');

        try {
            if (isEditing) {
                // Update Firestore ONLY (We don't update Firebase Auth here as it requires re-authentication)
                const userRef = doc(db, "users", editingUserId);

                const updates = {
                    fullName: formData.fullName,
                    role: formData.role
                };

                if (formData.role === 'student') {
                    updates.classId = formData.classId;
                    updates.batch = formData.batch;
                }

                await updateDoc(userRef, updates);
            } else {
                // 1. Create heavily isolated user via Secondary Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
                const newUid = userCredential.user.uid;

                const newUser = {
                    fullName: formData.fullName,
                    email: formData.email,
                    role: formData.role,
                    createdAt: new Date().toISOString()
                };

                if (formData.role === 'student' && formData.classId) {
                    newUser.classId = formData.classId;
                    newUser.batch = formData.batch;

                    // Generate Enrollment Number
                    const currentClassStudents = users.filter(u => u.role === 'student' && u.classId === formData.classId);
                    const count = currentClassStudents.length + 1;
                    const paddedCount = String(count).padStart(3, '0');
                    newUser.enrollmentNo = `ENR-${formData.classId.substring(0, 4).toUpperCase()}-${paddedCount}`;
                }

                // 2. Add to Firestore using primary DB connection
                await setDoc(doc(db, "users", newUid), newUser);
                await addLog(`Created user: ${formData.fullName || formData.email}`, currentUser?.email);
                toast.success(`User ${formData.fullName} created!`);

                // 3. Auto-enroll in existing subjects
                if (formData.role === 'student' && formData.classId) {
                    try {
                        const qSubjects = query(collection(db, 'subjects'), where('classId', '==', formData.classId));
                        const subSnap = await getDocs(qSubjects);
                        if (!subSnap.empty) {
                            const enrollBatch = writeBatch(db);
                            subSnap.forEach(subDoc => {
                                enrollBatch.update(subDoc.ref, {
                                    enrolledStudents: arrayUnion(newUid)
                                });
                            });
                            await enrollBatch.commit();
                        }
                    } catch (e) {
                        console.error("Failed to auto-enroll student in subjects:", e);
                    }
                }

            }

            closeUserModal();
        } catch (err) {
            console.error("Error saving user:", err);
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoadingCreate(false);
        }
    };

    const handleBulkUpload = async (e) => {
        e.preventDefault();
        if (!bulkFile) return;

        setIsParsing(true);
        setError('');

        Papa.parse(bulkFile, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                const batch = writeBatch(db);
                let successCount = 0;
                let failCount = 0;
                const classToStudentsMap = {};

                try {
                    for (const row of data) {
                        const Name = row.Name?.trim();
                        const Email = row.Email?.trim();
                        const ClassId = row.ClassId?.trim();
                        const Batch = row.Batch?.trim();
                        const EnrollmentNo = row.EnrollmentNo?.trim();

                        if (!Name || !Email || !ClassId) {
                            failCount++;
                            continue;
                        }

                        // Try to find the actual class Document ID by matching
                        let mappedClassId = ClassId;
                        const matchedClass = classesData.find(c =>
                            c.id === ClassId ||
                            c.className?.toLowerCase() === ClassId.toLowerCase() ||
                            `${c.className} ${c.section}`.toLowerCase() === ClassId.toLowerCase() ||
                            `${c.className}-${c.section}`.toLowerCase() === ClassId.toLowerCase() ||
                            `${c.className} - ${c.section}`.toLowerCase() === ClassId.toLowerCase() ||
                            `${c.className} - ${c.section} (${c.gradeLevel})`.toLowerCase() === ClassId.toLowerCase()
                        );

                        if (matchedClass) {
                            mappedClassId = matchedClass.id;
                        } else {
                            console.error(`Could not map CSV ClassId '${ClassId}' to any Firestore Class Document. Double check the spelling or copy the Document ID directly!`);
                            failCount++;
                            continue;
                        }

                        try {
                            // 1. Create Auth Account
                            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, Email, 'Student@123');
                            const uid = userCredential.user.uid;

                            // 2. Prepare Firestore Data
                            const studentData = {
                                fullName: Name,
                                email: Email,
                                role: 'student',
                                classId: mappedClassId,
                                batch: Batch || 'All',
                                createdAt: new Date().toISOString()
                            };

                            // Priority Logic for Enrollment Number
                            let finalEnrollmentNo = '';
                            if (EnrollmentNo && EnrollmentNo.trim() !== '') {
                                finalEnrollmentNo = String(EnrollmentNo).trim();

                                // Conflict Check
                                const existingStudent = users.find(u => u.enrollmentNo === finalEnrollmentNo);
                                if (existingStudent) {
                                    console.warn(`Skipping row. EnrollmentNo ${finalEnrollmentNo} already exists.`);
                                    failCount++;
                                    continue;
                                }
                            } else {
                                // Fallback: Auto-generate sequential enrollment number
                                const currentClassStudents = users.filter(u => u.role === 'student' && u.classId === mappedClassId);
                                const count = currentClassStudents.length + (successCount + 1);
                                const paddedCount = String(count).padStart(3, '0');
                                finalEnrollmentNo = `ENR-${mappedClassId.substring(0, 4).toUpperCase()}-${paddedCount}`;
                            }
                            studentData.enrollmentNo = finalEnrollmentNo;

                            const userRef = doc(db, 'users', uid);
                            batch.set(userRef, studentData);
                            successCount++;

                            if (!classToStudentsMap[mappedClassId]) {
                                classToStudentsMap[mappedClassId] = [];
                            }
                            classToStudentsMap[mappedClassId].push(uid);

                        } catch (err) {
                            console.error(`Error creating student ${Email}:`, err);
                            failCount++;
                        }
                    }

                    if (successCount > 0) {
                        try {
                            const enrollBatch = writeBatch(db);
                            let enrollUpdates = 0;

                            for (const [clsId, uids] of Object.entries(classToStudentsMap)) {
                                if (!uids.length) continue;
                                const qSub = query(collection(db, 'subjects'), where('classId', '==', clsId));
                                const snapSub = await getDocs(qSub);
                                snapSub.forEach(subDoc => {
                                    enrollBatch.update(subDoc.ref, {
                                        enrolledStudents: arrayUnion(...uids)
                                    });
                                    enrollUpdates++;
                                });
                            }

                            if (enrollUpdates > 0) {
                                await enrollBatch.commit();
                            }
                        } catch (err) {
                            console.error("Failed to auto-enroll bulk students:", err);
                        }

                        await batch.commit();

                        await addLog(`Bulk upload: imported ${successCount} students`, currentUser?.email);
                        toast.success(`Successfully imported ${successCount} students!`);
                        if (failCount > 0) toast.error(`Failed to import ${failCount} rows.`);
                    } else if (failCount > 0) {
                        toast.error("All rows failed to import. Check console or CSV format.");
                    }

                    setShowBulkModal(false);
                    setBulkFile(null);
                } catch (err) {
                    console.error("Fatal error during bulk import:", err);
                    setError("Bulk import failed: " + err.message);
                    toast.error("Bulk Import Failed");
                } finally {
                    setIsParsing(false);
                }
            },
            error: (err) => {
                console.error("CSV Parse Error:", err);
                setError("Failed to parse CSV: " + err.message);
                setIsParsing(false);
            }
        });
    };

    const requestDelete = (type, data) => {
        setDeleteConfig({ isOpen: true, type, data });
    };

    const confirmDelete = async () => {
        const { type, data } = deleteConfig;
        if (!data) return;

        try {
            if (type === 'user') {
                await deleteDoc(doc(db, "users", data.id));
                console.warn(`Firestore document for ${data.email} deleted. Auth must be removed manually.`);
                await addLog(`Deleted user: ${data.email}`, currentUser?.email);
            } else if (type === 'subject') {
                await deleteDoc(doc(db, "subjects", data.id));
                await addLog(`Subject ${data.subjectName} was deleted`, currentUser?.email);
            } else if (type === 'class') {
                const classSubjects = subjects.filter(s => s.classId === data.id);
                const classStudents = users.filter(u => u.classId === data.id);
                if (classSubjects.length > 0 || classStudents.length > 0) {
                    toast.error(`Cannot delete class. It has ${classStudents.length} students and ${classSubjects.length} subjects associated.`);
                    return;
                }
                await deleteDoc(doc(db, "classes", data.id));
                await addLog(`Class ${data.className} was deleted`, currentUser?.email);
                toast.success('Class deleted successfully!');
            }
            setDeleteConfig({ isOpen: false, type: null, data: null });
        } catch (err) {
            console.error(`Error deleting ${type}:`, err);
            alert(`Failed to delete ${type}: ` + err.message);
        }
    };

    // Utility: Parse HH:mm to minutes from midnight
    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    // Helper: Check schedules for overlaps
    const passesScheduleValidation = async (newSchedules, targetTeacherId, skipSubjectId = null) => {
        if (!newSchedules || newSchedules.length === 0) return true;

        // Fetch all subjects taught by this teacher
        const qTeacherSubjects = query(collection(db, 'subjects'), where('teacherId', '==', targetTeacherId));
        const snap = await getDocs(qTeacherSubjects);

        let allExistingSchedules = [];
        snap.docs.forEach(docSnap => {
            if (docSnap.id === skipSubjectId) return; // Ignore the subject being edited
            const data = docSnap.data();
            if (data.schedule && Array.isArray(data.schedule)) {
                data.schedule.forEach(slot => {
                    allExistingSchedules.push({ ...slot, subjectName: data.subjectName, classId: data.classId });
                });
            }
        });

        // Cross-check all new slots against existing slots
        for (const newSlot of newSchedules) {
            if (!newSlot.day || !newSlot.startTime || !newSlot.endTime) continue;
            const newStart = timeToMinutes(newSlot.startTime);
            const newEnd = timeToMinutes(newSlot.endTime);

            for (const existingSlot of allExistingSchedules) {
                if (existingSlot.day === newSlot.day) {
                    const existingStart = timeToMinutes(existingSlot.startTime);
                    const existingEnd = timeToMinutes(existingSlot.endTime);

                    // Overlap Condition
                    if (newStart < existingEnd && newEnd > existingStart) {
                        const className = classesData.find(c => c.id === existingSlot.classId)?.className || 'another class';
                        throw new Error(`Conflict: Teacher is already assigned to ${existingSlot.subjectName} (${className}) on ${existingSlot.day} from ${existingSlot.startTime} to ${existingSlot.endTime}.`);
                    }
                }
            }
        }
        return true;
    };

    const handleCreateSubject = async (e) => {
        e.preventDefault();
        if (!subjectData.classId) {
            setError("You must assign this subject to a Class.");
            return;
        }

        setLoadingCreate(true);
        setError('');

        try {
            // Run Teacher Availability Validation
            await passesScheduleValidation(
                subjectData.schedule,
                subjectData.teacherId,
                isEditingSubject ? editingSubjectId : null
            );
            if (isEditingSubject) {
                const subjectRef = doc(db, "subjects", editingSubjectId);
                await updateDoc(subjectRef, {
                    subjectName: subjectData.subjectName,
                    subjectCode: subjectData.subjectCode,
                    teacherId: subjectData.teacherId,
                    classId: subjectData.classId,
                    schedule: subjectData.schedule || []
                });
                alert("Subject Updated Successfully!");
            } else {
                const subjectRef = doc(collection(db, "subjects"));


                // Auto-enroll existing students in this class
                let existingStudentIds = [];
                try {
                    const qStudents = query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', subjectData.classId));
                    const stuSnap = await getDocs(qStudents);
                    existingStudentIds = stuSnap.docs.map(st => st.id);
                } catch (e) {
                    console.error("Failed to fetch students for new subject:", e);
                }

                await setDoc(subjectRef, {
                    subjectName: subjectData.subjectName,
                    subjectCode: subjectData.subjectCode,
                    teacherId: subjectData.teacherId,
                    classId: subjectData.classId,
                    schedule: subjectData.schedule || [],
                    enrolledStudents: existingStudentIds,
                    createdAt: new Date().toISOString()
                });
                await addLog(`Created subject: ${subjectData.subjectName}`, currentUser?.email);
                alert("Subject Created Successfully!");
            }

            closeSubjectModal();
        } catch (err) {
            console.error("Error creating subject:", err);
            setError(err.message);
        } finally {
            setLoadingCreate(false);
        }
    };

    const handleCreateClass = async (e) => {
        e.preventDefault();
        setLoadingCreate(true);
        setError('');

        try {
            const classRef = doc(collection(db, "classes"));
            await setDoc(classRef, {
                ...classForm,
                createdAt: new Date().toISOString()
            });
            await addLog(`Admin created Class: ${classForm.gradeLevel} - ${classForm.section}`, currentUser?.email);
            alert("Class Created Successfully!");
            setShowClassModal(false);
            setClassForm({ className: '', section: '', gradeLevel: '' });
        } catch (err) {
            console.error("Error creating class:", err);
            setError(err.message);
        } finally {
            setLoadingCreate(false);
        }
    };

    const openEditModal = (user) => {
        setIsEditing(true);
        setEditingUserId(user.id);
        setFormData({
            fullName: user.fullName || '',
            email: user.email,
            password: 'unchanged', // Mock value since we can't edit it
            role: user.role,
            classId: user.classId || '',
            batch: user.batch || 'All'
        });
        setShowModal(true);
    };

    const closeUserModal = () => {
        setShowModal(false);
        setIsEditing(false);
        setEditingUserId(null);
        setFormData({ fullName: '', email: '', password: '', role: 'student', classId: '', batch: 'All' });
        setError('');
    };

    const closeSubjectModal = () => {
        setShowSubjectModal(false);
        setIsEditingSubject(false);
        setEditingSubjectId(null);
        setSubjectData({ subjectName: '', subjectCode: '', teacherId: '', classId: '', schedule: [] });
        setError('');
    };

    const openEditSubjectModal = (subject) => {
        setIsEditingSubject(true);
        setEditingSubjectId(subject.id);
        setSubjectData({
            subjectName: subject.subjectName,
            subjectCode: subject.subjectCode,
            teacherId: subject.teacherId || '',
            classId: subject.classId || '',
            schedule: subject.schedule || []
        });
        setShowSubjectModal(true);
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">Admin</span>;
            case 'teacher':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">Teacher</span>;
            case 'student':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 capitalize">Student</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">{role || 'Unknown'}</span>;
        }
    };

    return (
        <div className="p-8">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <div className="flex space-x-6">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {activeTab === 'users' ? 'User Management' : 'Academic Overview'}
                        </h2>
                    </div>
                    <div className="space-x-3 flex">
                        {activeTab === 'subjects' && (
                            <>
                                <button
                                    onClick={() => setShowClassModal(true)}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm font-medium text-sm text-center flex items-center"
                                >
                                    <GraduationCap className="w-4 h-4 mr-2" />
                                    Add Class
                                </button>
                                <button
                                    onClick={() => setShowSubjectModal(true)}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium text-sm text-center flex items-center"
                                >
                                    <BookOpen className="w-4 h-4 mr-2" />
                                    Create Subject
                                </button>
                            </>
                        )}
                        {activeTab === 'users' && (
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setShowBulkModal(true)}
                                    className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg hover:bg-emerald-100 transition shadow-sm font-medium text-sm text-center flex items-center"
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Bulk CSV
                                </button>
                                <button
                                    onClick={() => {
                                        setFormData({ fullName: '', email: '', password: '', role: 'student', classId: '', batch: 'All' });
                                        setIsEditing(false);
                                        setShowModal(true);
                                    }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm font-medium text-sm text-center flex items-center"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add User
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex space-x-4">
                                {['admins', 'teachers', 'students'].map((role) => (
                                    <button
                                        key={role}
                                        onClick={() => setActiveRoleTab(role)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeRoleTab === role
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        {role.charAt(0).toUpperCase() + role.slice(1)}
                                    </button>
                                ))}
                            </div>

                            {activeRoleTab === 'students' && (
                                <button
                                    onClick={async () => {
                                        if (!window.confirm("Auto-assign Batch and Class to legacy students?")) return;
                                        setLoading(true);
                                        try {
                                            const studentUsers = users.filter(u => u.role === 'student');
                                            const defaultClass = classesData[0];
                                            if (!defaultClass) {
                                                alert("Please create at least one Class first.");
                                                return;
                                            }

                                            let count = 1;
                                            for (let student of studentUsers) {
                                                if (!student.classId || !student.enrollmentNo) {
                                                    const paddedCount = String(count).padStart(3, '0');
                                                    const eNo = `ENR-${defaultClass.id.substring(0, 4).toUpperCase()}-${paddedCount}`;

                                                    await updateDoc(doc(db, "users", student.id), {
                                                        classId: defaultClass.id,
                                                        batch: count % 3 === 0 ? 'C' : count % 2 === 0 ? 'B' : 'A',
                                                        enrollmentNo: eNo
                                                    });
                                                    count++;
                                                }
                                            }
                                            alert("Completed Identity Migration!");
                                        } catch (e) {
                                            console.error(e);
                                            alert("Migration failed");
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-lg text-sm font-medium transition border border-purple-200"
                                >
                                    Auto-Assign Identity
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {users.filter(u => u.role === activeRoleTab.replace(/s$/, '')).length > 0 ? (
                                            users.filter(u => u.role === activeRoleTab.replace(/s$/, '')).map(user => (
                                                <tr key={user.id} className="hover:bg-gray-50 transition">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {user.fullName || user.name || 'Unnamed User'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {user.email}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {getRoleBadge(user.role)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button onClick={() => openEditModal(user)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                                            <Edit className="w-4 h-4 inline" /> <span className="sr-only">Edit</span>
                                                        </button>
                                                        <button onClick={() => requestDelete('user', user)} className="text-red-600 hover:text-red-900">
                                                            <Trash2 className="w-4 h-4 inline" /> <span className="sr-only">Delete</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                                                    No {activeRoleTab} found in the system.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* SUBJECTS TAB */}
                {activeTab === 'subjects' && (
                    loadingSubjects ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Teacher</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students Enrolled</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {classesData.length > 0 ? (
                                        classesData.map(cls => {
                                            const classSubjects = subjects.filter(s => s.classId === cls.id);
                                            const isExpanded = expandedClasses.has(cls.id);
                                            return (
                                                <React.Fragment key={cls.id}>
                                                    <tr
                                                        className="bg-indigo-50 border-t border-b border-indigo-100 cursor-pointer hover:bg-indigo-100 transition"
                                                        onClick={() => toggleClass(cls.id)}
                                                    >
                                                        <td colSpan="5" className="px-6 py-3 text-sm font-bold text-indigo-900 uppercase tracking-wide">
                                                            <div className="flex justify-between items-center">
                                                                <span>{cls.className} - {cls.section} ({cls.gradeLevel})</span>
                                                                <div className="flex items-center space-x-4">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); requestDelete('class', cls); }}
                                                                        className="text-red-400 hover:text-red-600 transition"
                                                                        title="Delete Class"
                                                                    >
                                                                        <Trash2 className="w-5 h-5 inline" />
                                                                    </button>
                                                                    {isExpanded ? <ChevronDown className="w-5 h-5 text-indigo-500" /> : <ChevronRight className="w-5 h-5 text-indigo-400" />}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        classSubjects.length > 0 ? (
                                                            classSubjects.map(subject => {
                                                                const teacher = users.find(u => u.id === subject.teacherId);
                                                                return (
                                                                    <tr key={subject.id} className="hover:bg-gray-50 transition">
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 pl-10">
                                                                            {subject.subjectName}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                            {subject.subjectCode}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                            {teacher ? teacher.fullName : 'Unassigned'}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                            {subject.enrolledStudents?.length || 0}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                            <button onClick={() => openEditSubjectModal(subject)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                                                                <Edit className="w-4 h-4 inline" /> <span className="sr-only">Edit Subject</span>
                                                                            </button>
                                                                            <button onClick={() => requestDelete('subject', subject)} className="text-red-600 hover:text-red-900">
                                                                                <Trash2 className="w-4 h-4 inline" /> <span className="sr-only">Delete</span>
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        ) : (
                                                            <tr>
                                                                <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-400 italic pl-10">
                                                                    No subjects assigned to this class yet.
                                                                </td>
                                                            </tr>
                                                        )
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                                                No classes found. Create a Class to start adding Subjects.
                                            </td>
                                        </tr>
                                    )}

                                    {/* Unassigned Subjects */}
                                    {subjects.filter(s => !s.classId).length > 0 && (
                                        <React.Fragment>
                                            <tr className="bg-orange-50 border-t border-b border-orange-100">
                                                <td colSpan="5" className="px-6 py-2 text-sm font-bold text-orange-900 uppercase tracking-wide">
                                                    Unassigned Subjects (Legacy)
                                                </td>
                                            </tr>
                                            {subjects.filter(s => !s.classId).map(subject => {
                                                const teacher = users.find(u => u.id === subject.teacherId);
                                                return (
                                                    <tr key={subject.id} className="hover:bg-gray-50 transition">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {subject.subjectName}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {subject.subjectCode}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {teacher ? teacher.fullName : 'Unassigned'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {subject.enrolledStudents?.length || 0}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button onClick={() => openEditSubjectModal(subject)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                                                <Edit className="w-4 h-4 inline" /> <span className="sr-only">Edit Subject</span>
                                                            </button>
                                                            <button onClick={() => requestDelete('subject', subject)} className="text-red-600 hover:text-red-900">
                                                                <Trash2 className="w-4 h-4 inline" /> <span className="sr-only">Delete</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* Add User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">{isEditing ? 'Edit User' : 'Add New User'}</h2>
                            <button
                                onClick={closeUserModal}
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6">
                            {error && (
                                <div className="mb-4 flex items-center space-x-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        disabled={isEditing}
                                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 ${isEditing ? 'bg-gray-100' : ''}`}
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                    {isEditing && <p className="text-xs text-gray-500 mt-1">Email cannot be changed after creation.</p>}
                                </div>
                                {!isEditing && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                                        <input
                                            type="password"
                                            required
                                            minLength="6"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="student">Student</option>
                                        <option value="teacher">Teacher</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                {formData.role === 'student' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Class</label>
                                            <select
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                                value={formData.classId}
                                                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                            >
                                                <option value="" disabled>Select a Class...</option>
                                                {classesData.map(cls => (
                                                    <option key={cls.id} value={cls.id}>
                                                        {cls.className} - {cls.section} ({cls.gradeLevel})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
                                            <select
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                                value={formData.batch}
                                                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                                            >
                                                <option value="All">All / General</option>
                                                <option value="A">Batch A</option>
                                                <option value="B">Batch B</option>
                                                <option value="C">Batch C</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="mt-8 flex space-x-3 justify-end">
                                <button
                                    type="button"
                                    onClick={closeUserModal}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingCreate}
                                    className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center ${loadingCreate ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {loadingCreate ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (isEditing ? 'Update User' : 'Create User')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Subject Modal */}
            {showSubjectModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">{isEditingSubject ? 'Edit Subject' : 'Create New Subject'}</h2>
                            <button
                                onClick={closeSubjectModal}
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubject} className="p-6">
                            {error && (
                                <div className="mb-4 flex items-center space-x-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={subjectData.subjectName}
                                        onChange={(e) => setSubjectData({ ...subjectData, subjectName: e.target.value })}
                                        placeholder="e.g. Introduction to React"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={subjectData.subjectCode}
                                        onChange={(e) => setSubjectData({ ...subjectData, subjectCode: e.target.value })}
                                        placeholder="e.g. CS-101"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign Class</label>
                                    <select
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={subjectData.classId}
                                        onChange={(e) => setSubjectData({ ...subjectData, classId: e.target.value })}
                                    >
                                        <option value="" disabled>Select a Class...</option>
                                        {classesData.map(cls => (
                                            <option key={cls.id} value={cls.id}>
                                                {cls.className} - {cls.section} ({cls.gradeLevel})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher</label>
                                    <select
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={subjectData.teacherId}
                                        onChange={(e) => setSubjectData({ ...subjectData, teacherId: e.target.value })}
                                    >
                                        <option value="" disabled>Select a Teacher...</option>
                                        {users.filter(u => u.role === 'teacher').map(teacher => (
                                            <option key={teacher.id} value={teacher.id}>
                                                {teacher.fullName} ({teacher.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Time Table / Schedule Section */}
                                <div className="border-t border-gray-200 pt-4 mt-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-sm font-bold text-gray-800 flex items-center">
                                            <Clock className="w-4 h-4 mr-2 text-indigo-600" /> Time Table Configuration
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setSubjectData(prev => ({
                                                ...prev,
                                                schedule: [...(prev.schedule || []), { day: 'Monday', startTime: '09:35', endTime: '10:30', batch: 'All', room: '' }]
                                            }))}
                                            className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-100 flex items-center transition"
                                        >
                                            <Plus className="w-3 h-3 mr-1" /> Add Slot
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {(!subjectData.schedule || subjectData.schedule.length === 0) && (
                                            <p className="text-sm text-gray-500 italic text-center py-2">No schedule blocks assigned yet.</p>
                                        )}
                                        {subjectData.schedule?.map((slot, index) => (
                                            <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200 relative">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newSchedule = [...subjectData.schedule];
                                                        newSchedule.splice(index, 1);
                                                        setSubjectData({ ...subjectData, schedule: newSchedule });
                                                    }}
                                                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>

                                                <div className="grid grid-cols-2 gap-3 pr-6">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">Day</label>
                                                        <select
                                                            required
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                                            value={slot.day}
                                                            onChange={(e) => {
                                                                const s = [...subjectData.schedule];
                                                                s[index].day = e.target.value;
                                                                setSubjectData({ ...subjectData, schedule: s });
                                                            }}
                                                        >
                                                            <option>Monday</option>
                                                            <option>Tuesday</option>
                                                            <option>Wednesday</option>
                                                            <option>Thursday</option>
                                                            <option>Friday</option>
                                                            <option>Saturday</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
                                                        <select
                                                            required
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                                            value={slot.batch}
                                                            onChange={(e) => {
                                                                const s = [...subjectData.schedule];
                                                                s[index].batch = e.target.value;
                                                                setSubjectData({ ...subjectData, schedule: s });
                                                            }}
                                                        >
                                                            <option>All</option>
                                                            <option>A</option>
                                                            <option>B</option>
                                                            <option>C</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
                                                        <input
                                                            type="time"
                                                            required
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                                            value={slot.startTime}
                                                            onChange={(e) => {
                                                                const s = [...subjectData.schedule];
                                                                s[index].startTime = e.target.value;
                                                                setSubjectData({ ...subjectData, schedule: s });
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
                                                        <input
                                                            type="time"
                                                            required
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                                            value={slot.endTime}
                                                            onChange={(e) => {
                                                                const s = [...subjectData.schedule];
                                                                s[index].endTime = e.target.value;
                                                                setSubjectData({ ...subjectData, schedule: s });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">Room No.</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="e.g. Lab 101, F4"
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                                            value={slot.room}
                                                            onChange={(e) => {
                                                                const s = [...subjectData.schedule];
                                                                s[index].room = e.target.value;
                                                                setSubjectData({ ...subjectData, schedule: s });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex space-x-3 justify-end">
                                <button
                                    type="button"
                                    onClick={closeSubjectModal}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingCreate}
                                    className={`px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm flex items-center ${loadingCreate ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {loadingCreate ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (isEditingSubject ? 'Update Subject' : 'Create Subject')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-emerald-50">
                            <h2 className="text-xl font-bold text-emerald-900 flex items-center">
                                <Upload className="w-5 h-5 mr-2" /> Bulk Student Import
                            </h2>
                            <button
                                onClick={() => setShowBulkModal(false)}
                                className="text-emerald-400 hover:text-emerald-600 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleBulkUpload} className="p-6">
                            <div className="mb-6">
                                <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    <strong>Required Headers:</strong> Name, Email, ClassId, Batch, EnrollmentNo.
                                    <br />
                                    <span className="text-xs italic">* EnrollmentNo will be auto-generated if left blank.</span>
                                </p>

                                {error && (
                                    <div className="mb-4 flex items-center space-x-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div
                                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer ${bulkFile ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
                                        }`}
                                    onClick={() => document.getElementById('bulk-csv-input').click()}
                                >
                                    <input
                                        id="bulk-csv-input"
                                        type="file"
                                        accept=".csv"
                                        className="hidden"
                                        onChange={(e) => setBulkFile(e.target.files[0])}
                                    />
                                    {bulkFile ? (
                                        <>
                                            <FileText className="w-12 h-12 text-emerald-600 mb-2" />
                                            <p className="text-sm font-bold text-gray-900">{bulkFile.name}</p>
                                            <button
                                                type="button"
                                                className="text-xs text-red-500 underline mt-2"
                                                onClick={(e) => { e.stopPropagation(); setBulkFile(null); }}
                                            >
                                                Remove File
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-12 h-12 text-gray-300 mb-2" />
                                            <p className="text-sm font-medium text-gray-700">Click to upload or drag & drop</p>
                                            <p className="text-xs text-gray-500 mt-1">Accepts .CSV files only</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex space-x-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkModal(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!bulkFile || isParsing}
                                    className={`px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm flex items-center ${(!bulkFile || isParsing) ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isParsing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Importing...
                                        </>
                                    ) : 'Start Import'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {deleteConfig.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Confirm Deletion</h2>
                        <p className="text-gray-500 text-sm mb-6">
                            Are you sure you want to delete this {deleteConfig.type}?
                            {deleteConfig.type === 'user' && " WARNING: Their login credentials must be deleted from the Firebase Console manually."}
                        </p>
                        <div className="flex justify-center space-x-3">
                            <button
                                onClick={() => setDeleteConfig({ isOpen: false, type: null, data: null })}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm"
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Class Modal */}
            {showClassModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">Create New Class</h2>
                            <button
                                onClick={() => setShowClassModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateClass} className="p-6">
                            {error && (
                                <div className="mb-4 flex items-center space-x-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                                        value={classForm.className}
                                        onChange={(e) => setClassForm({ ...classForm, className: e.target.value })}
                                        placeholder="e.g. Science Track"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                                        value={classForm.section}
                                        onChange={(e) => setClassForm({ ...classForm, section: e.target.value })}
                                        placeholder="e.g. Div A"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                    <select
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                                        value={classForm.gradeLevel}
                                        onChange={(e) => setClassForm({ ...classForm, gradeLevel: e.target.value })}
                                    >
                                        <option value="" disabled>Select Year...</option>
                                        <option value="FY">FY</option>
                                        <option value="SY">SY</option>
                                        <option value="TY">TY</option>
                                        <option value="LY">LY</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-8 flex space-x-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowClassModal(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingCreate}
                                    className={`px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm flex items-center ${loadingCreate ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {loadingCreate ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : 'Create Class'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
