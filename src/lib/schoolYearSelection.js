const CASHIER_SCHOOL_YEAR_KEY = 'cashier:selectedSchoolYearId'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function getSavedCashierSchoolYearId() {
  try {
    const stored = window.localStorage.getItem(CASHIER_SCHOOL_YEAR_KEY)
    if (stored) return stored
  } catch {
    // Fall through to cookie fallback.
  }

  try {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${CASHIER_SCHOOL_YEAR_KEY}=`))
    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : ''
  } catch {
    return ''
  }
}

export function saveCashierSchoolYearId(schoolYearId) {
  if (!schoolYearId) return
  try {
    window.localStorage.setItem(CASHIER_SCHOOL_YEAR_KEY, schoolYearId)
  } catch {
    // Keep going; cookie fallback below usually survives logout/session cleanup.
  }

  try {
    document.cookie = `${CASHIER_SCHOOL_YEAR_KEY}=${encodeURIComponent(schoolYearId)}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax`
  } catch {
    // Ignore storage failures; the page can still fall back to active school year.
  }
}
