import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SidebarLayout from './components/SidebarLayout';
import { Toaster } from 'react-hot-toast';

// Pages
import Login from './pages/Login';
import Home from './pages/admin/Home';
import AdminDashboard from './pages/admin/AdminDashboard';
import SystemLogs from './pages/admin/SystemLogs';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherClasses from './pages/teacher/TeacherClasses';
import TeacherSchedule from './pages/teacher/TeacherSchedule';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentSubjects from './pages/student/StudentSubjects';
import AttendanceView from './pages/student/AttendanceView';
import StudentAcademicRecords from './pages/student/StudentAcademicRecords';
import StudentTimeTable from './pages/student/StudentTimeTable';

const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    if (user.role === 'admin') return <Navigate to="/admin/home" replace />;
    if (user.role === 'teacher') return <Navigate to="/teacher/classes" replace />;
    if (user.role === 'student') return <Navigate to="/student/subjects" replace />;

    // Fallback if role is unrecognized
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<SidebarLayout><Outlet /></SidebarLayout>}>
              <Route path="home" element={<Home />} />
              <Route path="users" element={<AdminDashboard defaultTab="users" />} />
              <Route path="academic" element={<AdminDashboard defaultTab="subjects" />} />
              <Route path="logs" element={<SystemLogs />} />
              <Route index element={<Navigate to="home" replace />} />
            </Route>
          </Route>

          {/* Teacher Routes */}
          <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
            <Route path="/teacher" element={<SidebarLayout><Outlet /></SidebarLayout>}>
              <Route path="classes" element={<TeacherClasses />} />
              <Route path="academic-records" element={<TeacherDashboard />} />
              <Route path="schedule" element={<TeacherSchedule />} />
              <Route index element={<Navigate to="classes" replace />} />
            </Route>
          </Route>

          {/* Student Routes */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/student" element={<SidebarLayout><Outlet /></SidebarLayout>}>
              <Route path="subjects" element={<StudentSubjects />} />
              <Route path="academic-records" element={<StudentAcademicRecords />} />
              <Route path="schedule" element={<StudentTimeTable />} />
              <Route index element={<Navigate to="subjects" replace />} />
            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Simple outlet component for nested routing within layout
const Outlet = React.lazy(() => import('react-router-dom').then(m => ({ default: m.Outlet })));

export default App;
