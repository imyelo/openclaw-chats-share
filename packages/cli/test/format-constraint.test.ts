import { describe, expect, it } from 'bun:test'
import { ConstraintValidator, createConstraint, createValidator, DEFAULT_CONSTRAINT } from '../src/index'

describe('ConstraintValidator', () => {
  it('should validate valid data', () => {
    const validator = createValidator(DEFAULT_CONSTRAINT)
    const result = validator.validate({
      title: 'Test Session',
      date: '2026-02-17',
      sessionId: 'test-123',
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail on missing required fields', () => {
    const validator = createValidator(DEFAULT_CONSTRAINT)
    const result = validator.validate({
      title: 'Test Session',
      // missing date and sessionId
    })

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
    const errorFields = result.errors.map(e => e.field)
    expect(errorFields).toContain('date')
    expect(errorFields).toContain('sessionId')
  })

  it('should validate minLength', () => {
    const constraint = createConstraint({
      validation: [{ field: 'title', rule: 'minLength', value: 5 }],
    })
    const validator = createValidator(constraint)

    // Too short
    let result = validator.validate({ title: 'Hi', date: '2026-01-01', sessionId: '123' })
    expect(result.valid).toBe(false)

    // Just right
    result = validator.validate({ title: 'Hello', date: '2026-01-01', sessionId: '123' })
    expect(result.valid).toBe(true)
  })

  it('should validate maxLength', () => {
    const constraint = createConstraint({
      validation: [{ field: 'title', rule: 'maxLength', value: 10 }],
    })
    const validator = createValidator(constraint)

    // Too long
    let result = validator.validate({ title: 'This is too long', date: '2026-01-01', sessionId: '123' })
    expect(result.valid).toBe(false)

    // Within limit
    result = validator.validate({ title: 'Short', date: '2026-01-01', sessionId: '123' })
    expect(result.valid).toBe(true)
  })

  it('should use custom error message when provided', () => {
    const constraint = createConstraint({
      validation: [{ field: 'title', rule: 'minLength', value: 10, message: 'Title is too short' }],
    })
    const validator = createValidator(constraint)

    const result = validator.validate({ title: 'Hi', date: '2026-01-01', sessionId: '123' })
    const titleError = result.errors.find(e => e.field === 'title' && e.message === 'Title is too short')
    expect(titleError).toBeDefined()
  })

  it('should validate pattern', () => {
    const constraint = createConstraint({
      validation: [{ field: 'sessionId', rule: 'pattern', value: '^session-\\d+$' }],
    })
    const validator = createValidator(constraint)

    // Invalid pattern
    let result = validator.validate({ sessionId: 'abc', title: 'Test', date: '2026-01-01' })
    expect(result.valid).toBe(false)

    // Valid pattern
    result = validator.validate({ sessionId: 'session-123', title: 'Test', date: '2026-01-01' })
    expect(result.valid).toBe(true)
  })

  it('should get metadata fields', () => {
    const validator = createValidator(DEFAULT_CONSTRAINT)
    const fields = validator.getMetadataFields()

    expect(fields).toHaveLength(7)
    expect(fields[0].key).toBe('title')
  })

  it('should get sections in order', () => {
    const validator = createValidator(DEFAULT_CONSTRAINT)
    const sections = validator.getSections()

    expect(sections).toHaveLength(3)
    expect(sections[0].id).toBe('summary')
    expect(sections[1].id).toBe('conversation')
    expect(sections[2].id).toBe('tool-calls')
  })

  it('should extend constraint with custom fields', () => {
    const validator = createValidator(DEFAULT_CONSTRAINT)
    const extended = validator.extend({
      metadata: [{ key: 'customField', type: 'string', required: false, description: 'Custom field' }],
    })

    expect(extended.metadata).toHaveLength(8)
    expect(extended.metadata[7].key).toBe('customField')
  })
})

describe('createConstraint', () => {
  it('should create constraint with defaults', () => {
    const constraint = createConstraint()

    expect(constraint.version).toBe('1.0')
    expect(constraint.name).toBe('session-export')
    expect(constraint.metadata).toHaveLength(7)
  })

  it('should allow custom override', () => {
    const constraint = createConstraint({
      name: 'custom-format',
      metadata: [{ key: 'extra', type: 'string', required: false }],
    })

    expect(constraint.name).toBe('custom-format')
    expect(constraint.metadata).toHaveLength(8)
  })
})
