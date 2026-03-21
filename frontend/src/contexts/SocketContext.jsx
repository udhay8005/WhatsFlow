/**
 * @file SocketContext.jsx
 * @description Global Socket.IO context. Creates a single WebSocket connection on
 *              app mount and tears it down on unmount, preventing memory leaks from
 *              repeated socket instantiation during navigation. Exposes the socket
 *              instance and connection state via useSocket() hook.
 * @module contexts/SocketContext
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function SocketProvider({ children }) {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const socket = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 2000,
        });

        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));

        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}
