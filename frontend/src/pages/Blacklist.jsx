import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Trash2, Plus, Search, ShieldAlert } from 'lucide-react';

export default function Blacklist() {
    const [blacklist, setBlacklist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPhone, setNewPhone] = useState('');
    const [reason, setReason] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchBlacklist();
    }, []);

    const fetchBlacklist = async () => {
        try {
            const res = await apiService.getBlacklist(); // Need to add this to api.ts
            setBlacklist(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await apiService.addToBlacklist(newPhone, reason);
            setNewPhone('');
            setReason('');
            fetchBlacklist();
        } catch (err) {
            alert('Failed to add number');
        }
    };

    const handleDelete = async (phone) => {
        if (!confirm(`Unblock ${phone}?`)) return;
        try {
            await apiService.removeFromBlacklist(phone);
            fetchBlacklist();
        } catch (err) {
            alert('Failed to remove');
        }
    };

    const filtered = blacklist.filter(item => item.phone_number.includes(searchTerm));

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <ShieldAlert className="text-red-500" size={32} />
                Blacklist Management
            </h1>

            {/* Add New */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Block a Number</h2>
                <form onSubmit={handleAdd} className="flex gap-4">
                    <input
                        type="text"
                        placeholder="Phone Number (e.g. 919876543210)"
                        className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Reason (Optional)"
                        className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                    />
                    <button
                        type="submit"
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                    >
                        <Plus size={18} /> Block
                    </button>
                </form>
            </div>

            {/* List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Blocked Numbers ({blacklist.length})</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search numbers..."
                            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">Phone Number</th>
                                <th className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">Reason</th>
                                <th className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">Date Blocked</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No blocked numbers found.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => (
                                    <tr key={item.phone_number} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {item.phone_number}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                            {item.reason || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-500">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(item.phone_number)}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                                title="Unblock"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
