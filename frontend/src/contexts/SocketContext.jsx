/**
 * @file SocketContext.jsx
 * @description Global Socket.IO context. Creates a single WebSocket connection on
 *              app mount and tears it down on unmount, preventing memory leaks from
 *              repeated socket instantiation during navigation. Exposes the socket
 *              instance and connection state via useSocket() hook.
 * @module contexts/SocketContext
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function SocketProvider({ children }) {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    // Track socket in state so consumers re-render when the connection is established.
    // Accessing socketRef.current directly in JSX is disallowed by react-hooks/rules-of-hooks.
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const instance = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 2000,
        });

        instance.on('connect', () => setConnected(true));
        instance.on('disconnect', () => setConnected(false));

        socketRef.current = instance;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSocket(instance);

        return () => {
            instance.disconnect();
            socketRef.current = null;
            setSocket(null);
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
    return useContext(SocketContext);
}
