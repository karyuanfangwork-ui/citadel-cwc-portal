import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/auth.service';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles?: string[];
    agentTeam?: string | null;
}

interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    department?: string;
    jobTitle?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    accessToken: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    useEffect(() => {
        // Ask the server if we have a valid session (cookie sent automatically)
        authService.getCurrentUser()
            .then(setUser)
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = async (email: string, password: string) => {
        const { accessToken: token } = await authService.login({ email, password });
        setAccessToken(token ?? null);
    };

    const register = async (data: RegisterData) => {
        const registeredUser = await authService.register(data);
        setUser(registeredUser);
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
        setAccessToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, accessToken, login, register, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
