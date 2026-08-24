type RegistrationInput = { name: string; email: string; password: string };
type LoginInput = Pick<RegistrationInput, "email" | "password">;

const maxNameLength = 100;
const maxEmailLength = 254;
const maxPasswordLength = 128;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== "string") throw new Error(`${field} is required`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
};

const normalizeEmail = (value: unknown): string => {
  const email = requiredString(value, "Email").toLowerCase();
  if (email.length > maxEmailLength || !emailPattern.test(email)) throw new Error("Email is invalid");
  return email;
};

const normalizePassword = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("Password is required");
  if (value.length < 6) throw new Error("Password must be at least 6 characters");
  if (value.length > maxPasswordLength) throw new Error("Password must be at most 128 characters");
  return value;
};

export const normalizeRegistrationInput = (input: Record<string, unknown>): RegistrationInput => {
  const name = requiredString(input.name, "Name");
  if (name.length > maxNameLength) throw new Error("Name must be at most 100 characters");
  return { name, email: normalizeEmail(input.email), password: normalizePassword(input.password) };
};

export const normalizeLoginInput = (input: Record<string, unknown>): LoginInput => ({
  email: normalizeEmail(input.email),
  password: normalizePassword(input.password),
});
