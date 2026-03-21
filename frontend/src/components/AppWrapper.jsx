/**
 * @file AppWrapper.jsx
 * @description Top-level wrapper component that provides the ToastProvider
 *              to the entire React tree, enabling toast notifications from any
 *              descendant component via the useToast() hook.
 * @module components/AppWrapper
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

import React, { Component } from 'react';
import { ToastProvider } from './Toast';

// Wrap entire app with ToastProvider
export default class AppWrapper extends Component {
    render() {
        return (
            <ToastProvider>
                {this.props.children}
            </ToastProvider>
        );
    }
}
