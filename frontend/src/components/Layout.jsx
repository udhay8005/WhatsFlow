import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { MessageSquare, Settings as SettingsIcon, LayoutDashboard, History, Send, Sun, Moon, ShieldAlert } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import logo from '../assets/logo.png';

export default function Layout() {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors">
                <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={logo} alt="WhatsFlow" className="w-8 h-8" />
                        <span className="text-xl font-bold tracking-tight">WhatsFlow</span>
                    </div>
                    <button
                        onClick={() => {
                            console.log('[Layout] Theme toggle clicked');
                            toggleTheme();
                        }}
                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {theme === 'dark' ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-gray-700" />}
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <NavItem to="/" icon={<LayoutDashboard />} label="Dashboard" />
                    <NavItem to="/campaigns/new" icon={<MessageSquare />} label="New Campaign" />
                    <NavItem to="/history" icon={<History />} label="History" />
                    <NavItem to="/blacklist" icon={<ShieldAlert />} label="Blacklist" />
                    <NavItem to="/settings" icon={<SettingsIcon />} label="Settings" />
                </nav>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 transition-colors">
                    <BackendStatus />
                    <p className="text-xs mt-1">v1.0.0 Localhost</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950 p-8 transition-colors">
                <div className="max-w-6xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

function NavItem({ to, icon, label }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-green-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`
            }
        >
            {icon}
            <span>{label}</span>
        </NavLink>
    );
}

function BackendStatus() {
    const [isOnline, setIsOnline] = React.useState(false);

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                // Simple health check via existing config endpoint
                const res = await fetch('/api/settings/config');
                setIsOnline(res.ok);
            } catch (e) {
                setIsOnline(false);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    return (
        <p>
            Status: {' '}
            <span className={isOnline ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                ● {isOnline ? 'Online' : 'Offline'}
            </span>
        </p>
    );
}
