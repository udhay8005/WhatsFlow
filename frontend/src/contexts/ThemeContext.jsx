import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

// Initialize theme immediately to prevent flash
if (typeof window !== 'undefined') {
    try {
        const saved = localStorage.getItem('whatsflow-theme');
        // Default to dark if nothing saved
        const theme = saved || 'dark';
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        console.log('[ThemeInit] Initialized theme to:', theme);
    } catch (e) {
        console.error('[ThemeInit] Error accessing localStorage:', e);
    }
}

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('whatsflow-theme');
            return saved || 'dark';
        }
        return 'dark';
    });

    useEffect(() => {
        console.log('[ThemeContext] Effect Triggered. Theme is:', theme);
        try {
            localStorage.setItem('whatsflow-theme', theme);
            const root = window.document.documentElement;

            console.log('[ThemeContext] Creating class list update...');
            if (theme === 'dark') {
                console.log('[ThemeContext] ADDING dark class');
                root.classList.add('dark');
            } else {
                console.log('[ThemeContext] REMOVING dark class');
                root.classList.remove('dark');
            }
            console.log('[ThemeContext] Current HTML classes:', root.className);
        } catch (error) {
            console.error('[ThemeContext] Error in useEffect:', error);
        }
    }, [theme]);

    const toggleTheme = () => {
        console.log('[ThemeContext] toggleTheme function called. Current:', theme);
        setTheme(prev => {
            const newTheme = prev === 'dark' ? 'light' : 'dark';
            console.log('[ThemeContext] Setting theme to:', newTheme);
            return newTheme;
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
