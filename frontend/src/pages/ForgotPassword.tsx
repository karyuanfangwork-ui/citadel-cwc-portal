import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth.service';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email.trim()) {
            setError('Please enter your email address');
            return;
        }
        setLoading(true);
        try {
            await authService.forgotPassword(email.trim());
            setSent(true);
        } catch (err: any) {
            // Always show success-like message to prevent user enumeration
            setSent(true);
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="flex flex-col md:flex-row min-h-screen">
                <div style={{
                    background: 'linear-gradient(160deg, #0d1830 0%, #1D2D5E 55%, #2a4a7f 100%)',
                    padding: 'var(--space-10) var(--space-8)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                }} className="w-full md:w-[420px] flex-shrink-0 min-h-[280px] md:min-h-screen">
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 'var(--space-3)' }}>Check your email</h1>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                            If an account exists for that email, we've sent instructions to reset your password.
                        </p>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center p-6 md:p-12" style={{ background: 'var(--color-surface)' }}>
                    <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#10b981', display: 'block', marginBottom: 'var(--space-4)' }}>
                            mark_email_read
                        </span>
                        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                            Check Your Inbox
                        </h2>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
                            We've sent a password reset link to <strong>{email}</strong>. The link will expire in 15 minutes.
                        </p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
                            Didn't receive the email? Check your spam folder or try again.
                        </p>
                        <Link
                            to="/forgot-password"
                            onClick={() => { setSent(false); setEmail(''); }}
                            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-brand-700)', fontWeight: 700, textDecoration: 'none' }}
                        >
                            Try again with a different email
                        </Link>
                        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)' }}>
                            <Link to="/login" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-brand-700)', fontWeight: 700, textDecoration: 'none' }}>
                                ← Back to Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row min-h-screen">
            <div style={{
                background: 'linear-gradient(160deg, #0d1830 0%, #1D2D5E 55%, #2a4a7f 100%)',
                padding: 'var(--space-10) var(--space-8)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
            }} className="w-full md:w-[420px] flex-shrink-0 min-h-[280px] md:min-h-screen">
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 'var(--space-3)' }}>
                        Forgot your<br /><span style={{ color: '#5BBFE8', fontWeight: 700 }}>password?</span>
                    </h1>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                        No worries. Enter your email and we'll send you a link to reset it.
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
                        Enter the email address associated with your account.
                    </p>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {error && (
                            <div style={{
                                background: '#fef2f2', border: '1px solid #fecaca',
                                borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)',
                                fontSize: 'var(--text-sm)', color: '#dc2626',
                            }}>{error}</div>
                        )}

                        <div>
                            <label htmlFor="email" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                                Email address
                            </label>
                            <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{
                                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                                    fontSize: '18px', color: 'var(--color-text-tertiary)', pointerEvents: 'none',
                                }}>mail</span>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@company.com"
                                    style={{
                                        width: '100%', padding: '11px 14px 11px 40px',
                                        border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                                        background: 'var(--color-surface-subtle)', fontSize: 'var(--text-sm)',
                                        color: 'var(--color-text-primary)', outline: 'none',
                                        transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand-700)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-100)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'var(--color-surface-subtle)'; }}
                                />
                            </div>
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
                                    Sending...
                                </span>
                            ) : 'Send Reset Link →'}
                        </button>
                    </form>

                    <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)' }}>
                        <Link to="/login" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-brand-700)', fontWeight: 700, textDecoration: 'none' }}>
                            ← Back to Sign In
                        </Link>
                    </div>
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default ForgotPassword;