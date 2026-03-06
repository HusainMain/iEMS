import React from 'react';

const Attendance = () => {
    return (
        <div className="p-8">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Attendance Management</h1>
                <p className="text-gray-600">Interface for marking daily student attendance.</p>
                {/* Interface placeholder */}
                <div className="mt-6 border border-gray-200 rounded-md p-4">
                    <p className="text-sm text-gray-500">Select a date and class to retrieve student list.</p>
                </div>
            </div>
        </div>
    );
};

export default Attendance;
