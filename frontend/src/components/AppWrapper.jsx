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
