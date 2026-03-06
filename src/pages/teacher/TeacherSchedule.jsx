import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase.config';
import { Loader2, Calendar, Clock, MapPin, Users } from 'lucide-react';

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

const TeacherSchedule = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [schedules, setSchedules] = useState([]); 

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!user?.uid) return;
            try {
                const cSnap = await getDocs(collection(db, 'classes'));
                const classesData = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Fetch Subjects taught by this teacher
                const qSub = query(collection(db, 'subjects'), where('teacherId', '==', user.uid));
                const sSnap = await getDocs(qSub);
                
                let allBlocks = [];
                sSnap.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.schedule && Array.isArray(data.schedule)) {
                        data.schedule.forEach(block => {
                            const classInfo = classesData.find(c => c.id === data.classId);
                            const className = classInfo ? `${classInfo.className} - ${classInfo.section}` : 'Unknown Class';
                            
                            allBlocks.push({
                                id: `${docSnap.id}-${block.day}-${block.startTime}`,
                                subjectName: data.subjectName,
                                className,
                                ...block
                            });
                        });
                    }
                });
                setSchedules(allBlocks);
            } catch (error) {
                console.error("Error fetching schedule data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSchedule();
    }, [user]);

    const getBlocksForSlot = (day, timeSlotData) => {
        if (timeSlotData.type === 'recess') return null; // Handled separately
        
        return schedules.filter(s => 
            s.day === day && 
            isSlotInWindow(s.startTime, s.endTime, timeSlotData.label)
        );
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Calendar className="w-7 h-7 mr-3 text-indigo-600" /> My Schedule
            </h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                                                                    <div className="font-bold text-indigo-900 text-sm leading-tight mb-1">{b.className}</div>
                                                                    <div className="text-indigo-700 text-xs font-medium mb-2">{b.subjectName}</div>
                                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
                                                                        <span className="flex items-center text-indigo-600 font-medium bg-white px-1.5 py-0.5 rounded border border-indigo-50">
                                                                            <Users className="w-3 h-3 mr-1" /> Batch {b.batch}
                                                                        </span>
                                                                        <span className="flex items-center">
                                                                            <MapPin className="w-3 h-3 mr-1" /> {b.room}
                                                                        </span>
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

export default TeacherSchedule;
