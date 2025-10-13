import axios from 'axios';

const API_BASE_URL = window.location.origin + '/api';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests if available
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle token expiration
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

class AuthService {
    // Register new user
    async register(userData) {
        try {
            const response = await api.post('/auth/register', userData);
            
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            }
            
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Registration failed');
        }
    }

    // Login user
    async login(credentials) {
        try {
            const response = await api.post('/auth/login', credentials);
            
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            }
            
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Login failed');
        }
    }

    // Logout user
    async logout() {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }

    // Get current user profile
    async getProfile() {
        try {
            const response = await api.get('/auth/profile');
            return response.data.user;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to get profile');
        }
    }

    // Verify token
    async verifyToken() {
        try {
            const response = await api.get('/auth/verify');
            return response.data;
        } catch (error) {
            return { valid: false };
        }
    }

    // Get stored token
    getToken() {
        return localStorage.getItem('token');
    }

    // Get stored user
    getUser() {
        try {
            const user = localStorage.getItem('user');
            return user ? JSON.parse(user) : null;
        } catch (error) {
            console.error('Error parsing user data:', error);
            this.clearAuthData();
            return null;
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        try {
            const token = this.getToken();
            const user = this.getUser();

            if (!token || !user) {
                return false;
            }

            // Basic token format validation
            if (token.split('.').length !== 3) {
                console.warn('Invalid token format');
                this.clearAuthData();
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error checking authentication:', error);
            this.clearAuthData();
            return false;
        }
    }

    // Set authentication data
    setAuthData(token, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }

    // Clear authentication data
    clearAuthData() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
}

export default new AuthService();
