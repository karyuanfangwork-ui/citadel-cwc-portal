import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/auth.service';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

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

    const passwordStrength = getPasswordStrength(newPassword);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!token) {
            setError('Invalid or missing reset token. Please request a new password reset link.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        try {
            await authService.resetPassword(token, newPassword);
            setSuccess(true);
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Failed to reset password. The link may have expired.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!token && !success) {
        return (
            <div className="flex flex-col md:flex-row min-h-screen">
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c1445 100%)',
                    padding: 'var(--space-10) var(--space-8)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden',
                }} className="w-full md:w-[420px] flex-shrink-0 min-h-[280px] md:min-h-screen">
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 'var(--space-3)' }}>
                            Invalid Link
                        </h1>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                            This password reset link is invalid or may have expired.
                        </p>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center p-6 md:p-12" style={{ background: 'var(--color-surface)' }}>
                    <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ef4444', display: 'block', marginBottom: 'var(--space-4)' }}>
                            error
                        </span>
                        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                            Link Expired or Invalid
                        </h2>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
                            This password reset link is invalid or has expired. Please request a new one.
                        </p>
                        <a
                            href="/forgot-password"
                            style={{
                                display: 'inline-block', padding: '12px 24px',
                                background: 'linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-500) 100%)',
                                color: '#fff', borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)', fontWeight: 800, textDecoration: 'none',
                            }}
                        >
                            Request New Link
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="flex flex-col md:flex-row min-h-screen">
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c1445 100%)',
                    padding: 'var(--space-10) var(--space-8)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden',
                }} className="w-full md:w-[420px] flex-shrink-0 min-h-[280px] md:min-h-screen">
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 'var(--space-3)' }}>
                            Password<br /><span style={{ color: '#10b981', fontWeight: 700 }}>Reset!</span>
                        </h1>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                            Your password has been successfully updated.
                        </p>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center p-6 md:p-12" style={{ background: 'var(--color-surface)' }}>
                    <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#10b981', display: 'block', marginBottom: 'var(--space-4)' }}>
                            check_circle
                        </span>
                        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                            Password Updated
                        </h2>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
                            Your password has been successfully reset. You can now sign in with your new password.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                display: 'inline-block', padding: '13px 32px',
                                background: 'linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-500) 100%)',
                                border: 'none', borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)', fontWeight: 800, color: '#fff', cursor: 'pointer',
                            }}
                        >
                            Sign In →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row min-h-screen">
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c1445 100%)',
                padding: 'var(--space-10) var(--space-8)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                position: 'relative', overflow: 'hidden',
            }} className="w-full md:w-[420px] flex-shrink-0 min-h-[280px] md:min-h-screen">
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 'var(--space-3)' }}>
                        Set your<br /><span style={{ color: '#60a5fa', fontWeight: 700 }}>new password</span>
                    </h1>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                        Choose a strong password that you haven't used before.
                    </p>
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: 'var(--space-3)' }} />
                    <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                        © 2026 Citadel Group Technologies Sdn Bhd<br />Citadel Workplace Connect · All rights reserved
                    </p>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-6 md:p-12" style={{ background: 'var(--color-surface)' }}>
                <div style={{ width: '100%', maxWidth: '380px' }}>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                        Reset Password
                    </h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
                        Enter your new password below.
                    </p>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {error && (
                            <div style={{
                                background: '#fef2f2', border: '1px solid #fecaca',
                                borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)',
                                fontSize: 'var(--text-sm)', color: '#dc2626',
                                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                                {error}
                            </div>
                        )}

                        {/* New Password */}
                        <div>
                            <label htmlFor="newPassword" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                                New Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{
                                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                                    fontSize: '18px', color: 'var(--color-text-tertiary)', pointerEvents: 'none',
                                }}>lock</span>
                                <input
                                    id="newPassword"
                                    type={showNewPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                    style={{
                                        width: '100%', padding: '11px 44px 11px 40px',
                                        border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                                        background: 'var(--color-surface-subtle)', fontSize: 'var(--text-sm)',
                                        color: 'var(--color-text-primary)', outline: 'none',
                                        transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand-700)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-100)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'var(--color-surface-subtle)'; }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    tabIndex={-1}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center' }}
                                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showNewPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                            {newPassword && (
                                <div style={{ marginTop: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <div style={{ flex: 1, height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ width: `${(passwordStrength.score / 5) * 100}%`, height: '100%', background: passwordStrength.color, transition: 'width 0.2s, background 0.2s' }} />
                                    </div>
                                    <span style={{ fontSize: 'var(--text-xs)', color: passwordStrength.color, fontWeight: 600, minWidth: '70px' }}>{passwordStrength.label}</span>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirmPassword" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                                Confirm New Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{
                                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                                    fontSize: '18px', color: 'var(--color-text-tertiary)', pointerEvents: 'none',
                                }}>lock</span>
                                <input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your new password"
                                    style={{
                                        width: '100%', padding: '11px 44px 11px 40px',
                                        border: confirmPassword && newPassword !== confirmPassword ? '1.5px solid #ef4444' : '1.5px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--color-surface-subtle)', fontSize: 'var(--text-sm)',
                                        color: 'var(--color-text-primary)', outline: 'none',
                                        transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand-700)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-100)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
                                    onBlur={(e) => {
                                        if (confirmPassword && newPassword !== confirmPassword) {
                                            e.currentTarget.style.borderColor = '#ef4444';
                                        } else {
                                            e.currentTarget.style.borderColor = 'var(--color-border)';
                                        }
                                        e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'var(--color-surface-subtle)';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    tabIndex={-1}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center' }}
                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                            {confirmPassword && newPassword !== confirmPassword && (
                                <p style={{ fontSize: 'var(--text-xs)', color: '#ef4444', marginTop: 'var(--space-1)' }}>Passwords do not match</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%', padding: '13px',
                                background: loading ? 'var(--color-brand-700)' : 'linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-500) 100%)',
                                border: 'none', borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)', fontWeight: 800,
                                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s, transform 0.15s',
                                fontFamily: 'var(--font-sans)',
                            }}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                    Resetting...
                                </span>
                            ) : 'Reset Password'}
                        </button>
                    </form>

                    <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)' }}>
                        <a href="/login" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-brand-700)', fontWeight: 700, textDecoration: 'none' }}>← Back to Sign In</a>
                    </div>
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default ResetPassword;