import crypto from 'crypto';

export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
    score: number; // 0-4 strength score
}

export interface PasswordPolicy {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecial: boolean;
    checkBreach: boolean;
}

const DEFAULT_POLICY: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
    checkBreach: false, // Optional - requires API call
};

/**
 * Validate password against policy rules
 */
export function validatePassword(
    password: string,
    email?: string,
    firstName?: string,
    lastName?: string,
    policy: PasswordPolicy = DEFAULT_POLICY
): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < policy.minLength) {
        errors.push(`Password must be at least ${policy.minLength} characters long`);
    } else {
        score += 1;
        if (password.length >= 12) score += 1; // Bonus for length
    }

    // Complexity checks
    if (policy.requireUppercase) {
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        } else {
            score += 1;
        }
    }

    if (policy.requireLowercase) {
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        } else {
            score += 1;
        }
    }

    if (policy.requireNumber) {
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        } else {
            score += 1;
        }
    }

    if (policy.requireSpecial) {
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        } else {
            score += 1;
        }
    }

    // Personal info check
    if (email) {
        const emailPrefix = email.split('@')[0].toLowerCase();
        if (password.toLowerCase().includes(emailPrefix) && emailPrefix.length > 2) {
            errors.push('Password cannot contain your email address');
        }
    }

    if (firstName && firstName.length > 2) {
        if (password.toLowerCase().includes(firstName.toLowerCase())) {
            errors.push('Password cannot contain your first name');
        }
    }

    if (lastName && lastName.length > 2) {
        if (password.toLowerCase().includes(lastName.toLowerCase())) {
            errors.push('Password cannot contain your last name');
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        score: Math.min(score, 4), // Cap at 4
    };
}

/**
 * Check if password has been pwned using HaveIBeenPwned API
 * Uses k-anonymity: only sends first 5 chars of SHA1 hash
 */
export async function checkPasswordBreach(password: string): Promise<{
    isPwned: boolean;
    count?: number;
    error?: string;
}> {
    try {
        // SHA1 hash the password
        const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
        const prefix = hash.slice(0, 5);
        const suffix = hash.slice(5);

        // Query HaveIBeenPwned API
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
        if (!response.ok) {
            return { isPwned: false, error: 'Breach check unavailable' };
        }

        const text = await response.text();
        const lines = text.split('\n');

        for (const line of lines) {
            const [hashSuffix, count] = line.split(':');
            if (hashSuffix.trim() === suffix) {
                return { isPwned: true, count: parseInt(count, 10) };
            }
        }

        return { isPwned: false };
    } catch (error) {
        // Graceful fallback - don't block registration if API is down
        return { isPwned: false, error: 'Breach check failed' };
    }
}
