const PASSWORD_MIN_LENGTH = 8;

// Satu-satunya sumber kebijakan password.
// Dipakai oleh /register, /change-password, dan manajemen user,
// supaya aturan tidak pernah berbeda antar endpoint.
const validatePassword = (password) => {
    if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
        return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return "Password must contain both letters and numbers";
    }

    return null;
};

module.exports = {
    validatePassword,
    PASSWORD_MIN_LENGTH
};
