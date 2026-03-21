/**
 * @file ThemeContext.jsx
 * @description Global theme context. Persists the user's light/dark preference
 *              to localStorage and applies the 'dark' class to the HTML root element.
 *              An IIFE at module load time reads localStorage and sets the initial
 *              class before React renders, preventing a flash of un-themed content.
 * @module contexts/ThemeContext
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

/**
 * @function useTheme
 * @description Hook to access the current theme and toggle function.
 * @returns {{ theme: string, toggleTheme: function }} Theme context value.
 * @throws {Error} If used outside of ThemeProvider.
 */
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

// Apply initial theme class immediately to prevent flash of un-themed content
if (typeof window !== 'undefined') {
    try {
        const saved = localStorage.getItem('whatsflow-theme');
        const theme = saved || 'dark';
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    } catch (e) {
        // localStorage unavailable (private browsing or storage quota exceeded) — default to dark
        document.documentElement.classList.add('dark');
    }
}

/**
 * @function ThemeProvider
 * @description Provides theme state and toggleTheme to all descendant components.
 *              Persists the selected theme in localStorage on every change.
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('whatsflow-theme');
            return saved || 'dark';
        }
        return 'dark';
    });

    useEffect(() => {
        try {
            localStorage.setItem('whatsflow-theme', theme);
            const root = window.document.documentElement;
            if (theme === 'dark') {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        } catch (error) {
            // Non-fatal: theme will still apply in memory for this session
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
