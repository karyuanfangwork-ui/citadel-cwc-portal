import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/auth.service';

export interface DelegateUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles?: string[];
    permissions?: string[];
    agentTeam?: string | null;
    tenantId?: string | null;
    outOfOffice?: boolean;
    outOfOfficeUntil?: string | null;
    outOfOfficeMessage?: string | null;
    delegationEnabled?: boolean;
    delegatedToId?: string | null;
    delegatedTo?: DelegateUser | null;
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
    refreshUser: () => Promise<void>;
    updateOutOfOffice: (data: { outOfOffice: boolean; outOfOfficeUntil?: string; outOfOfficeMessage?: string }) => Promise<void>;
    updateDelegation: (data: { delegationEnabled: boolean; delegatedToId?: string | null }) => Promise<void>;
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
        const response = await authService.login({ email, password });
        setUser({
            id: response.id,
            email: response.email,
            firstName: response.firstName,
            lastName: response.lastName,
            roles: response.roles,
            permissions: response.permissions,
            agentTeam: response.agentTeam,
            tenantId: response.tenantId,
        });
        setAccessToken(response.accessToken ?? null);
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

    const refreshUser = async () => {
        const u = await authService.getCurrentUser();
        setUser(u);
    };

    const updateOutOfOffice = async (data: { outOfOffice: boolean; outOfOfficeUntil?: string; outOfOfficeMessage?: string }) => {
        const apiClient = (await import('../services/api')).default;
        const res = await apiClient.put('/users/me/out-of-office', data);
        setUser(prev => prev ? {
            ...prev,
            outOfOffice: res.data.data.outOfOffice,
            outOfOfficeUntil: res.data.data.outOfOfficeUntil,
            outOfOfficeMessage: res.data.data.outOfOfficeMessage,
            delegationEnabled: res.data.data.delegationEnabled ?? prev.delegationEnabled,
            delegatedToId: res.data.data.delegatedToId ?? prev.delegatedToId,
        } : prev);
    };

    const updateDelegation = async (data: { delegationEnabled: boolean; delegatedToId?: string | null }) => {
        const apiClient = (await import('../services/api')).default;
        const res = await apiClient.put('/users/me/delegation', data);
        setUser(prev => prev ? {
            ...prev,
            delegationEnabled: res.data.data.delegationEnabled,
            delegatedToId: res.data.data.delegatedToId ?? null,
            delegatedTo: res.data.data.delegatedTo ?? null,
        } : prev);
    };

    return (
        <AuthContext.Provider value={{ user, loading, accessToken, login, register, logout, isAuthenticated: !!user, refreshUser, updateOutOfOffice, updateDelegation }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};