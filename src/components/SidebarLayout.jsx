import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, BookOpen, Users, LayoutDashboard, Settings, Calendar } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { auth } from '../services/firebase.config';
import { signOut } from 'firebase/auth';

const SidebarLayout = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const menuItems = {
        admin: [
            { path: '/admin/home', label: 'Home', icon: LayoutDashboard },
            { path: '/admin/users', label: 'User Management', icon: Users },
            { path: '/admin/academic', label: 'Academic Overview', icon: BookOpen },
            { path: '/admin/logs', label: 'System Logs', icon: Settings },
        ],
        teacher: [
            { path: '/teacher/classes', label: 'My Classes', icon: BookOpen },
            { path: '/teacher/academic-records', label: 'Academic Records', icon: LayoutDashboard },
            { path: '/teacher/schedule', label: 'My Schedule', icon: Calendar },
        ],
        student: [
            { path: '/student/subjects', label: 'My Subjects', icon: BookOpen },
            { path: '/student/academic-records', label: 'Academic Records', icon: LayoutDashboard },
            { path: '/student/schedule', label: 'My Schedule', icon: Calendar },
        ]
    };

    const navItems = user && user.role ? menuItems[user.role] : [];

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className="w-64 bg-white shadow-lg flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-blue-600">iEMS Platform</h1>
                    <p className="text-sm text-gray-500 mt-1 capitalize">{user?.role} Portal</p>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname.startsWith(item.path);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t">
                    <div className="flex items-center px-4 py-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                            {user?.fullName?.charAt(0) || user?.email?.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {children}
            </div>
        </div>
    );
};

export default SidebarLayout;
