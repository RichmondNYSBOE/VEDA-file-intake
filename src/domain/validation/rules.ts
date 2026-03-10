/**
 * @file Pure CSV validation logic extracted from server actions.
 *
 * These functions contain no framework or infrastructure dependencies — they
 * operate entirely on plain strings and schema definitions.
 */

import { type FieldSchema } from "@/lib/file-schemas";
import { validationMessages } from "@/content/validation-messages";

// ---------------------------------------------------------------------------
// User-friendly formatting helpers
// ---------------------------------------------------------------------------

/** Convert an internal type name to a user-friendly label. */
export function friendlyTypeName(type: string): string {
  switch (type) {
    case "string":
      return "Text";
    case "number":
      return "Number";
    case "boolean":
      return "Yes/No (true or false)";
    case "date":
      return "Date (MM/DD/YYYY)";
    default:
      return type;
  }
}

/** Describe a cell value in user-friendly terms. */
export function friendlyValue(value: string): string {
  if (value === "" || value === '""' || value === "''") {
    return "Blank (empty)";
  }
  return `"${value}"`;
}

// ---------------------------------------------------------------------------
// Single-cell type validation
// ---------------------------------------------------------------------------

/** Validates a cell value against a field schema's expected type (string, number, boolean, date). */
export function validateType(value: string, fieldSchema: FieldSchema): boolean {
  const trimmedValue = value.trim();

  if (trimmedValue === '') {
    return fieldSchema.required === false;
  }

  switch (fieldSchema.type) {
    case "string":
      return true;
    case "number":
      return !isNaN(Number(trimmedValue));
    case "boolean": {
      const lowerValue = trimmedValue.toLowerCase();
      return lowerValue === 'true' || lowerValue === 'false';
    }
    case "date": {
      const dateRegex = /^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})$/;
      if (!dateRegex.test(trimmedValue)) {
        return false;
      }
      // Normalize 2-digit years to 4-digit (00-29 → 2000-2029, 30-99 → 1930-1999)
      const parts = trimmedValue.split("/");
      if (parts[2].length === 2) {
        const yy = parseInt(parts[2], 10);
        parts[2] = String(yy <= 29 ? 2000 + yy : 1900 + yy);
      }
      const date = new Date(`${parts[0]}/${parts[1]}/${parts[2]}`);
      return !isNaN(date.getTime());
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Full CSV row validation
// ---------------------------------------------------------------------------

/**
 * Validate CSV lines (including header row) against a schema.
 *
 * Checks that: (1) there is at least one data row, (2) headers match the
 * schema exactly, and (3) the first 5 data rows have the correct column
 * count and pass per-cell type validation.
 */
export function validateCsvRows(
  lines: string[],
  schema: FieldSchema[],
): { valid: boolean; message?: string } {
  // Must have header + at least one data row
  if (lines.length < 2) {
    return { valid: false, message: validationMessages.emptyCsv };
  }

  // Header validation
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const expectedHeaders = schema.map(s => s.name);
  if (headers.length !== expectedHeaders.length || !headers.every((h, i) => h === expectedHeaders[i])) {
    const missing = expectedHeaders.filter(h => !headers.includes(h));
    const extra = headers.filter(h => !expectedHeaders.includes(h));
    let errorMessage = validationMessages.columnMismatch.base;
    if (missing.length > 0) {
      errorMessage += validationMessages.columnMismatch.missingColumns(missing.join(', '));
    }
    if (extra.length > 0) {
      errorMessage += validationMessages.columnMismatch.unexpectedColumns(extra.join(', '));
    }
    errorMessage += validationMessages.columnMismatch.footer;
    return { valid: false, message: errorMessage };
  }

  // Row validation (first 5 data rows)
  const rowsToValidate = lines.slice(1, 6);
  for (let i = 0; i < rowsToValidate.length; i++) {
    const rowNumber = i + 2;
    const values = rowsToValidate[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

    if (values.length !== schema.length) {
      return {
        valid: false,
        message: validationMessages.rowValidation.wrongColumnCount(rowNumber, schema.length, values.length),
      };
    }

    for (let j = 0; j < schema.length; j++) {
      const value = values[j];
      const fieldSchema = schema[j];
      if (!validateType(value, fieldSchema)) {
        const friendlyExpected = friendlyTypeName(fieldSchema.type);
        const friendlyActual = friendlyValue(value);

        if (value.trim() === '' && fieldSchema.required !== false) {
          return {
            valid: false,
            message: validationMessages.rowValidation.requiredFieldBlank(rowNumber, fieldSchema.name),
          };
        }

        return {
          valid: false,
          message: validationMessages.rowValidation.typeMismatch(rowNumber, fieldSchema.name, friendlyExpected, friendlyActual),
        };
      }
    }
  }

  return { valid: true };
}
