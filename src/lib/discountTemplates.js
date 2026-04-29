const numeric = (value) => parseFloat(value || 0) || 0

export const activeDiscountTemplates = (templates = [], schoolYearId = '') =>
  templates.filter(template =>
    template?.is_active !== false && (!template.school_year_id || template.school_year_id === schoolYearId)
  )

export const calculateDiscountAmount = (template, totalAmount) => {
  if (!template) return 0

  const total = numeric(totalAmount)
  const value = Math.max(numeric(template.value), 0)

  if (template.type === 'percentage') {
    return Math.min(Math.max((total * value) / 100, 0), total)
  }

  return total > 0 ? Math.min(value, total) : value
}

export const discountAmountInputValue = (amount) =>
  (Math.round((parseFloat(amount || 0) || 0) * 100) / 100).toFixed(2)

export const formatDiscountTemplate = (template, totalAmount) => {
  if (!template) return 'Custom discount'

  const name = template.name || 'Discount'
  const value = numeric(template.value)
  if (template.type === 'percentage') {
    return `${name} (${value}% = ₱${discountAmountInputValue(calculateDiscountAmount(template, totalAmount))})`
  }

  return `${name} (₱${discountAmountInputValue(value)})`
}

export const findMatchingDiscountTemplate = (templates = [], discountAmount, totalAmount, schoolYearId = '') => {
  const amount = numeric(discountAmount)
  if (amount <= 0) return ''

  const match = activeDiscountTemplates(templates, schoolYearId).find(template =>
    Math.abs(calculateDiscountAmount(template, totalAmount) - amount) < 0.01
  )

  return match?.id || ''
}
