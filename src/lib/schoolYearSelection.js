const CASHIER_SCHOOL_YEAR_KEY = 'cashier:selectedSchoolYearId'

export function getSavedCashierSchoolYearId() {
  try {
    return window.localStorage.getItem(CASHIER_SCHOOL_YEAR_KEY) || ''
  } catch {
    return ''
  }
}

export function saveCashierSchoolYearId(schoolYearId) {
  if (!schoolYearId) return
  try {
    window.localStorage.setItem(CASHIER_SCHOOL_YEAR_KEY, schoolYearId)
  } catch {
    // Ignore storage failures; the page can still fall back to active school year.
  }
}
