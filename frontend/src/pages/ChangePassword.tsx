import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';

const ChangePassword = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Password strength calculation
    const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
        const checks = [
            password.length >= 8,
            /[A-Z]/.test(password),
            /[a-z]/.test(password),
            /[0-9]/.test(password),
            /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
        ];
        const score = checks.filter(Boolean).length;
        const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#10b981'];
        return { score, label: labels[score], color: colors[score] };
    };

    const passwordStrength = getPasswordStrength(formData.newPassword);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.newPassword !== formData.confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (formData.newPassword.length < 8) {
            setError('New password must be at least 8 characters');
            return;
        }

        setLoading(true);
        try {
            await authService.changePassword({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword,
                confirmPassword: formData.confirmPassword,
            });
            setSuccess(true);
            // Auto-redirect to login after 2 seconds
            setTimeout(async () => {
                await logout();
                navigate('/login');
            }, 2000);
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Failed to change password';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-lg mx-auto mt-16 px-4">
                <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 'var(--radius-lg, 12px)',
                    padding: 'var(--space-6, 24px)',
                    textAlign: 'center' as const,
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#10b981', display: 'block', marginBottom: 'var(--space-3, 12px)' }}>
                        check_circle
                    </span>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                        Password Changed Successfully
                    </h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                        You will be redirected to the login page shortly...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto mt-8 px-4">
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--color-brand-700)' }}>lock
                    </span>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-text-primary)' }}>
                        Change Password
                    </h1>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginLeft: '40px' }}>
                    {user ? `Signed in as ${user.firstName} ${user.lastName} (${user.email})` : 'Update your account password'}
                </p>
            </div>

            {/* Requirements card */}
            <div style={{
                background: 'var(--color-surface-subtle, #f8fafc)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: 'var(--space-4, 16px)',
                marginBottom: 'var(--space-6, 24px)',
            }}>
                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Password Requirements
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: 0, paddingLeft: '16px' }}>
                    <li style={{ fontSize: 'var(--text-xs)', color: formData.newPassword.length >= 8 ? '#10b981' : 'var(--color-text-tertiary)', transition: 'color 0.2s' }}>
                        At least 8 characters
                    </li>
                    <li style={{ fontSize: 'var(--text-xs)', color: /[A-Z]/.test(formData.newPassword) ? '#10b981' : 'var(--color-text-tertiary)', transition: 'color 0.2s' }}>
                        One uppercase letter
                    </li>
                    <li style={{ fontSize: 'var(--text-xs)', color: /[a-z]/.test(formData.newPassword) ? '#10b981' : 'var(--color-text-tertiary)', transition: 'color 0.2s' }}>
                        One lowercase letter
                    </li>
                    <li style={{ fontSize: 'var(--text-xs)', color: /[0-9]/.test(formData.newPassword) ? '#10b981' : 'var(--color-text-tertiary)', transition: 'color 0.2s' }}>
                        One number
                    </li>
                    <li style={{ fontSize: 'var(--text-xs)', color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.newPassword) ? '#10b981' : 'var(--color-text-tertiary)', transition: 'color 0.2s' }}>
                        One special character
                    </li>
                </ul>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5, 20px)' }}>
                {error && (
                    <div
                        id="form-error"
                        role="alert"
                        style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: 'var(--radius-md, 8px)',
                            padding: 'var(--space-3, 12px) var(--space-4, 16px)',
                            fontSize: 'var(--text-sm)',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                        {error}
                    </div>
                )}

                {/* Current Password */}
                <div>
                    <label htmlFor="currentPassword" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                        Current Password
                    </label>
                    <input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={formData.currentPassword}
                        onChange={handleChange}
                        placeholder="Enter your current password"
                        aria-invalid={!!error}
                        aria-describedby={error ? "form-error" : undefined}
                        style={{
                            width: '100%',
                            padding: '11px 14px',
                            border: '1.5px solid var(--color-border)',
                            borderRadius: 'var(--radius-md, 8px)',
                            background: 'var(--color-surface)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-text-primary)',
                            outline: 'none',
                            transition: 'border-color 0.15s, box-shadow 0.15s',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand-700)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-100)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--color-border)' }} />

                {/* New Password */}
                <div>
                    <label htmlFor="newPassword" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                        New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input
                            id="newPassword"
                            name="newPassword"
                            type={showNewPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            value={formData.newPassword}
                            onChange={handleChange}
                            placeholder="Enter your new password"
                            aria-invalid={!!error || (formData.newPassword.length > 0 && formData.newPassword.length < 8)}
                            aria-describedby={error ? "form-error" : undefined}
                            style={{
                                width: '100%',
                                padding: '11px 44px 11px 14px',
                                border: '1.5px solid var(--color-border)',
                                borderRadius: 'var(--radius-md, 8px)',
                                background: 'var(--color-surface)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--color-text-primary)',
                                outline: 'none',
                                transition: 'border-color 0.15s, box-shadow 0.15s',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand-700)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-100)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            tabIndex={-1}
                            style={{
                                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center',
                            }}
                            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                {showNewPassword ? 'visibility_off' : 'visibility'}
                            </span>
                        </button>
                    </div>
                    {formData.newPassword && (
                        <div style={{ marginTop: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div style={{ flex: 1, height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${(passwordStrength.score / 5) * 100}%`, height: '100%', background: passwordStrength.color, transition: 'width 0.2s, background 0.2s' }} />
                            </div>
                            <span style={{ fontSize: 'var(--text-xs)', color: passwordStrength.color, fontWeight: 600, minWidth: '70px' }}>{passwordStrength.label}</span>
                        </div>
                    )}
                </div>

                {/* Confirm New Password */}
                <div>
                    <label htmlFor="confirmPassword" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                        Confirm New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Confirm your new password"
                            aria-invalid={formData.confirmPassword && formData.newPassword !== formData.confirmPassword}
                            aria-describedby={(formData.confirmPassword && formData.newPassword !== formData.confirmPassword ? 'confirmPassword-error' : '') || (error ? 'form-error' : '') || undefined}
                            style={{
                                width: '100%',
                                padding: '11px 44px 11px 14px',
                                border: formData.confirmPassword && formData.newPassword !== formData.confirmPassword
                                    ? '1.5px solid #ef4444'
                                    : '1.5px solid var(--color-border)',
                                borderRadius: 'var(--radius-md, 8px)',
                                background: 'var(--color-surface)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--color-text-primary)',
                                outline: 'none',
                                transition: 'border-color 0.15s, box-shadow 0.15s',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand-700)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-100)'; }}
                            onBlur={(e) => {
                                if (formData.confirmPassword && formData.newPassword !== formData.confirmPassword) {
                                    e.currentTarget.style.borderColor = '#ef4444';
                                } else {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                }
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            tabIndex={-1}
                            style={{
                                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center',
                            }}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                </button>
            </div>
            {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                <p id="confirmPassword-error" role="alert" style={{ fontSize: 'var(--text-xs)', color: '#ef4444', marginTop: 'var(--space-1)' }}>Passwords do not match</p>
            )}
        </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        style={{
                            padding: '11px 24px',
                            background: 'var(--color-surface)',
                            border: '1.5px solid var(--color-border)',
                            borderRadius: 'var(--radius-md, 8px)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-subtle)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)'; }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '11px 24px',
                            background: loading
                                ? 'var(--color-brand-700)'
                                : 'linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-500) 100%)',
                            border: 'none',
                            borderRadius: 'var(--radius-md, 8px)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 800,
                            color: '#fff',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            transition: 'opacity 0.15s, transform 0.15s',
                            fontFamily: 'var(--font-sans)',
                        }}
                    >
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                                <span style={{
                                    display: 'inline-block', width: '14px', height: '14px',
                                    border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                                    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                                }} />
                                Changing password...
                            </span>
                        ) : 'Change Password'}
                    </button>
                </div>

                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                    After changing your password, you will be logged out of all devices and need to sign in again.
                </p>
            </form>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default ChangePassword;