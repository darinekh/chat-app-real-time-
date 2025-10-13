import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Chat from './components/Chat';
import authService from './services/authService';
import './App.css';

// Protected Route component
const ProtectedRoute = ({ children }) => {
    return authService.isAuthenticated() ? children : <Navigate to="/login" />;
};

// Public Route component (redirect to chat if already authenticated)
const PublicRoute = ({ children }) => {
    return !authService.isAuthenticated() ? children : <Navigate to="/chat" />;
};

const App = () => {
    return (
        <Router>
            <div className="app">
                <Routes>
                    {/* Default route - redirect based on authentication */}
                    <Route 
                        path="/" 
                        element={
                            authService.isAuthenticated() ? 
                            <Navigate to="/chat" /> : 
                            <Navigate to="/login" />
                        } 
                    />
                    
                    {/* Public routes */}
                    <Route 
                        path="/login" 
                        element={
                            <PublicRoute>
                                <LoginForm />
                            </PublicRoute>
                        } 
                    />
                    
                    <Route 
                        path="/register" 
                        element={
                            <PublicRoute>
                                <RegisterForm />
                            </PublicRoute>
                        } 
                    />
                    
                    {/* Protected routes */}
                    <Route 
                        path="/chat" 
                        element={
                            <ProtectedRoute>
                                <Chat />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* Catch all route */}
                    <Route 
                        path="*" 
                        element={<Navigate to="/" />} 
                    />
                </Routes>
            </div>
        </Router>
    );
};

export default App;
