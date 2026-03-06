import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase.config';
import { Loader2, Calendar, Clock, MapPin, UserCheck, Filter, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = [
    { label: '08:40 - 09:35', type: 'class' },
    { label: '09:35 - 10:30', type: 'class' },
    { label: '10:30 - 11:30', type: 'class' },
    { label: '11:30 - 12:15', type: 'recess', name: 'Recess' },
    { label: '12:15 - 01:15', type: 'class' },
    { label: '01:15 - 02:15', type: 'class' },
    { label: '02:15 - 02:30', type: 'recess', name: 'Recess' },
    { label: '02:30 - 03:30', type: 'class' },
    { label: '03:30 - 04:30', type: 'class' }
];

const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    let [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

const isSlotInWindow = (scheduleStart, scheduleEnd, slotLabel) => {
    const convertLabelToMins = (str) => {
        let [time, _] = [str.trim(), '']; 
        let [h, m] = time.split(':').map(Number);
        if (h < 7) h += 12; 
        return h * 60 + m;
    };

    const [startLabel, endLabel] = slotLabel.split(' - ');
    const slotStartMins = convertLabelToMins(startLabel);
    const slotEndMins = convertLabelToMins(endLabel);

    const sStart = parseTimeToMinutes(scheduleStart);
    const sEnd = parseTimeToMinutes(scheduleEnd);

    return (sStart < slotEndMins && sEnd > slotStartMins);
};

const StudentTimeTable = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [schedules, setSchedules] = useState([]);
    const [downloading, setDownloading] = useState(false);
    
    // user profile should have classId and batch now
    
    useEffect(() => {
        const fetchSchedule = async () => {
            if (!user?.uid || !user?.classId) return;
            try {
                // Fetch all teachers to map teacherId -> Name
                const uSnap = await getDocs(query(collection(db, 'users')));
                const allUsers = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const teachers = allUsers.filter(u => u.role === 'teacher');

                // Get all subjects
                const sSnap = await getDocs(collection(db, 'subjects'));
                
                const allBlocks = [];
                sSnap.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    // Filter subjects by the student's classId
                    if (data.classId === user.classId) {
                        if (data.schedule && Array.isArray(data.schedule)) {
                            const teacherInfo = teachers.find(t => t.id === data.teacherId);
                            const teacherName = teacherInfo ? teacherInfo.fullName || teacherInfo.name : 'Unknown Faculty';

                            data.schedule.forEach(block => {
                                allBlocks.push({
                                    id: `${docSnap.id}-${block.day}-${block.startTime}`,
                                    subjectName: data.subjectName,
                                    teacherName,
                                    ...block
                                });
                            });
                        }
                    }
                });
                setSchedules(allBlocks);
            } catch (error) {
                console.error("Error fetching timetable data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSchedule();
    }, [user]);

    const getBlocksForSlot = (day, timeSlotData) => {
        if (timeSlotData.type === 'recess') return null; 
        
        return schedules.filter(s => 
            s.day === day && 
            isSlotInWindow(s.startTime, s.endTime, timeSlotData.label) &&
            (s.batch === 'All' || s.batch === user?.batch)
        );
    };

    const handleDownloadPDF = async () => {
        setDownloading(true);
        const input = document.getElementById('timetable-grid');
        if (!input) {
            setDownloading(false);
            toast.error("Timetable grid element not found");
            return;
        }

        try {
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                logging: false,
            });
            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            // Add Header Title
            pdf.setFontSize(14);
            pdf.setFont("helvetica", "bold");
            const studentName = user?.fullName || user?.name || 'Student';
            pdf.text(`Official Timetable | ${studentName} | Enrollment: ${user?.enrollmentNo || 'N/A'} | Batch: ${user?.batch || 'All'}`, 14, 18);

            // Add Image
            pdf.addImage(imgData, 'PNG', 14, 25, pdfWidth - 28, pdfHeight);
            
            pdf.save(`Timetable_${user?.enrollmentNo || 'Schedule'}_${user?.batch || 'All'}.pdf`);
            toast.success("PDF Downloaded successfully!");
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error("Failed to download PDF. Please try again.");
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Calendar className="w-7 h-7 mr-3 text-indigo-600" /> My Time Table
                </h1>
                
                <div className="flex items-center space-x-4">
                    {user?.batch && user?.batch !== 'All' && (
                        <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center hidden md:flex">
                            <Filter className="w-4 h-4 mr-2 opacity-70" />
                            Viewing <strong>Batch {user.batch}</strong> Labs & Gen. Lectures
                        </div>
                    )}
                    
                    {user?.role === 'student' && (
                        <button
                            onClick={handleDownloadPDF}
                            disabled={downloading}
                            className={`flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition ${downloading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {downloading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            Download PDF
                        </button>
                    )}
                </div>
            </div>

            <div id="timetable-grid" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border-collapse table-fixed">
                        <thead className="bg-indigo-50">
                            <tr>
                                <th className="w-32 px-4 py-4 text-center text-xs font-black text-indigo-900 uppercase tracking-wider border-r border-indigo-100">Time</th>
                                {DAYS.map(day => (
                                    <th key={day} className="px-4 py-4 text-center text-xs font-black text-indigo-900 uppercase tracking-wider border-r border-indigo-100 last:border-0">{day}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {TIME_SLOTS.map((slot, idx) => (
                                <tr key={idx} className={slot.type === 'recess' ? 'bg-orange-50/50' : 'hover:bg-gray-50'}>
                                    <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-500 border-r border-gray-200 bg-gray-50 shadow-[inset_-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                                        <div className="flex flex-col items-center justify-center">
                                            <Clock className="w-3.5 h-3.5 mb-1 text-gray-400" />
                                            <span className="text-xs">{slot.label}</span>
                                        </div>
                                    </td>
                                    
                                    {slot.type === 'recess' ? (
                                        <td colSpan={5} className="px-6 py-3 text-center text-sm font-black text-orange-400 tracking-widest uppercase bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(251,146,60,0.05)_10px,rgba(251,146,60,0.05)_20px)] border-t-2 border-b-2 border-orange-100">
                                            {slot.name}
                                        </td>
                                    ) : (
                                        DAYS.map(day => {
                                            const blocks = getBlocksForSlot(day, slot);
                                            return (
                                                <td key={`${day}-${idx}`} className="px-2 py-2 border-r border-gray-200 align-top relative min-h-[100px]">
                                                    {blocks && blocks.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {blocks.map((b, i) => (
                                                                <div key={i} className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 shadow-sm hover:shadow-md transition">
                                                                    <div className="font-bold text-indigo-900 text-sm leading-tight mb-2">{b.subjectName}</div>
                                                                    <div className="flex flex-col gap-y-1.5 text-xs text-gray-600">
                                                                        <div className="flex items-center text-gray-700 font-medium">
                                                                            <UserCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> {b.teacherName}
                                                                        </div>
                                                                        <div className="flex items-center">
                                                                            <MapPin className="w-3.5 h-3.5 mr-1.5 text-red-400" /> {b.room}
                                                                        </div>
                                                                        {b.batch !== 'All' && (
                                                                           <div className="mt-1 inline-flex self-start px-1.5 py-0.5 rounded bg-white font-medium text-[10px] border border-indigo-50 text-indigo-500">
                                                                               Batch {b.batch}
                                                                           </div> 
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="h-full min-h-[80px] w-full items-center justify-center flex text-gray-200 text-xs font-medium">Free</div>
                                                    )}
                                                </td>
                                            );
                                        })
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StudentTimeTable;
