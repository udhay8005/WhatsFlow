/**
 * @file DeliveryTrendChart.jsx
 * @description Area chart displaying the 7-day WhatsApp message delivery trend.
 *              Adapts axis, grid, and tooltip colours based on the active theme
 *              (dark / light) using the useTheme() hook.
 * @module components/charts/DeliveryTrendChart
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

export default function DeliveryTrendChart({ data }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const gridColor    = isDark ? '#374151' : '#E5E7EB';
    const tickColor    = isDark ? '#9CA3AF' : '#6B7280';
    const tooltipBg    = isDark ? '#1F2937' : '#FFFFFF';
    const tooltipBorder = isDark ? '#374151' : '#E5E7EB';
    const tooltipText  = isDark ? '#F9FAFB' : '#111827';

    if (!data || data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                No trend data available
            </div>
        );
    }

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: tickColor }}
                        tickFormatter={(str) => {
                            const d = new Date(str);
                            return `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: tickColor }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: tooltipBg,
                            border: `1px solid ${tooltipBorder}`,
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            color: tooltipText,
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#16a34a"
                        fillOpacity={1}
                        fill="url(#colorCount)"
                        name="Messages Sent"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
