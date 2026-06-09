/**
 * Shared validation for person-name fields (Name / First name / Last name)
 * used across every role's profile editor so the rule can never drift.
 *
 * Rule: 2–15 characters after trimming whitespace.
 */
export const NAME_MIN = 2;
export const NAME_MAX = 15;

/**
 * Validate a name value. Returns an error message string when invalid, or
 * `null` when the value is acceptable.
 */
export function validateName(value: string | undefined | null, label = "Name"): string | null {
  const v = (value ?? "").trim();
  if (v.length === 0) return `${label} is required.`;
  if (v.length < NAME_MIN) return `${label} must be at least ${NAME_MIN} characters.`;
  if (v.length > NAME_MAX) return `${label} must be ${NAME_MAX} characters or fewer.`;
  return null;
}
