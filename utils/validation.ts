import { AppError } from "../middleware/error";

/**
 * Validates that all specified keys exist in the body.
 * Utilizes generic parameter T constraint for structural verification.
 */
export function checkRequiredFields<T extends Record<string, unknown>>(
  body: T | null | undefined,
  fields: Array<keyof T & string>
): void {
  if (!body) {
    throw new AppError("Request body is missing", 400);
  }
  for (const field of fields) {
    const val = body[field];
    if (
      val === undefined ||
      val === null ||
      (typeof val === "string" && val.trim() === "")
    ) {
      throw new AppError(
        `Field '${field}' is required and cannot be empty / الحقل مطلوب ولا يمكن أن يكون فارغاً`,
        400
      );
    }
  }
}

/**
 * Validates that an unknown value is a valid positive number.
 */
export function checkPositiveNumber(value: unknown, name: string): void {
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    throw new AppError(
      `Field '${name}' must be a valid positive number / يجب أن يكون رقماً إيجابياً صالحاً`,
      400
    );
  }
}

/**
 * Validates that an unknown value is an array.
 */
export function checkArray(value: unknown, name: string): void {
  if (!Array.isArray(value)) {
    throw new AppError(
      `Field '${name}' must be a list (array) / يجب أن يكون قائمة`,
      400
    );
  }
}
