/**
 * Format Constraint
 * Defines the structure and validation rules for md file output
 */

export interface MetadataField {
  key: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
  required: boolean
  description?: string
  defaultValue?: unknown
}

export interface ContentSection {
  id: string
  title: string
  order: number
  contentKey: string // Path to data key (e.g., 'messages', 'summary')
  template?: string // Optional inline template
}

export interface ValidationRule {
  field: string
  rule: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom'
  value?: unknown
  message?: string
}

export interface FormatConstraint {
  version: string
  name: string
  description?: string
  metadata: MetadataField[]
  sections: ContentSection[]
  validation: ValidationRule[]
  customFields?: Record<string, unknown>
}

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * Default constraint for Openclaw session export
 */
export const DEFAULT_CONSTRAINT: FormatConstraint = {
  version: '1.0',
  name: 'session-export',
  description: 'Default format for Openclaw session export',
  metadata: [
    { key: 'title', type: 'string', required: true, description: 'Session title' },
    { key: 'date', type: 'date', required: true, description: 'Session date' },
    { key: 'sessionId', type: 'string', required: true, description: 'Session ID' },
    { key: 'channel', type: 'string', required: false, description: 'Channel/platform name' },
    { key: 'model', type: 'string', required: false, description: 'AI model used' },
    { key: 'totalMessages', type: 'number', required: false, description: 'Total message count' },
    { key: 'totalTokens', type: 'number', required: false, description: 'Total tokens used' },
    { key: 'tags', type: 'array', required: false, description: 'Tags/categories' },
    { key: 'visibility', type: 'string', required: false, description: 'Visibility: public or private' },
    {
      key: 'defaultShowProcess',
      type: 'boolean',
      required: false,
      description: 'Show proecss by default',
      defaultValue: false,
    },
    { key: 'description', type: 'string', required: false, description: 'Brief description' },
    {
      key: 'participants',
      type: 'object',
      required: false,
      description: 'Participant map: name → { role: "human" | "agent" }',
    },
  ],
  sections: [
    { id: 'summary', title: 'Summary', order: 1, contentKey: 'summary' },
    { id: 'conversation', title: 'Conversation', order: 2, contentKey: 'messages' },
    { id: 'tool-calls', title: 'Tool Calls', order: 3, contentKey: 'toolCalls' },
  ],
  validation: [
    { field: 'title', rule: 'required' },
    { field: 'date', rule: 'required' },
    { field: 'sessionId', rule: 'required' },
  ],
}

/**
 * Format Constraint Validator
 */
export class ConstraintValidator {
  private constraint: FormatConstraint

  constructor(constraint: FormatConstraint) {
    this.constraint = constraint
  }

  /**
   * Validate data against the constraint
   */
  validate(data: Record<string, unknown>): ValidationResult {
    const errors: ValidationError[] = []

    // Validate required metadata fields
    for (const field of this.constraint.metadata) {
      if (field.required) {
        const value = data[field.key]
        if (value === undefined || value === null || value === '') {
          errors.push({
            field: field.key,
            message: `Required field "${field.key}" is missing`,
          })
        }
      }
    }

    // Validate using validation rules
    for (const rule of this.constraint.validation) {
      const value = data[rule.field]
      const error = this.applyRule(rule, value)
      if (error) {
        errors.push(error)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Apply a single validation rule
   */
  private applyRule(rule: ValidationRule, value: unknown): ValidationError | null {
    switch (rule.rule) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return { field: rule.field, message: rule.message || `Field "${rule.field}" is required` }
        }
        break

      case 'minLength':
        if (typeof value === 'string' && value.length < (rule.value as number)) {
          return {
            field: rule.field,
            message: rule.message || `Field "${rule.field}" must be at least ${rule.value} characters`,
          }
        }
        break

      case 'maxLength':
        if (typeof value === 'string' && value.length > (rule.value as number)) {
          return {
            field: rule.field,
            message: rule.message || `Field "${rule.field}" must be at most ${rule.value} characters`,
          }
        }
        break

      case 'pattern':
        if (typeof value === 'string') {
          const regex = new RegExp(rule.value as string)
          if (!regex.test(value)) {
            return {
              field: rule.field,
              message: rule.message || `Field "${rule.field}" does not match required pattern`,
            }
          }
        }
        break
    }

    return null
  }

  /**
   * Get constraint metadata fields
   */
  getMetadataFields(): MetadataField[] {
    return this.constraint.metadata
  }

  /**
   * Get constraint sections in order
   */
  getSections(): ContentSection[] {
    return [...this.constraint.sections].sort((a, b) => a.order - b.order)
  }

  /**
   * Extend constraint with custom fields
   */
  extend(additionalFields: Partial<FormatConstraint>): FormatConstraint {
    return {
      ...this.constraint,
      ...additionalFields,
      metadata: [...this.constraint.metadata, ...(additionalFields.metadata || [])],
      sections: [...this.constraint.sections, ...(additionalFields.sections || [])],
      validation: [...this.constraint.validation, ...(additionalFields.validation || [])],
    }
  }
}

/**
 * Create a constraint validator
 */
export function createValidator(constraint: FormatConstraint): ConstraintValidator {
  return new ConstraintValidator(constraint)
}

/**
 * Create a custom constraint
 */
export function createConstraint(options: Partial<FormatConstraint> = {}): FormatConstraint {
  return {
    ...DEFAULT_CONSTRAINT,
    ...options,
    metadata: [...DEFAULT_CONSTRAINT.metadata, ...(options.metadata || [])],
    sections: [...DEFAULT_CONSTRAINT.sections, ...(options.sections || [])],
    validation: [...DEFAULT_CONSTRAINT.validation, ...(options.validation || [])],
  }
}
