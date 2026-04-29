// src/utils/aiInsights.js — AI-Powered Analytics Engine for DepEd SMS
// Uses statistical analysis + heuristic AI to generate actionable insights

/**
 * Calculate student risk score (0-100)
 * Factors: grades, attendance, behavioral records, trend direction
 */
export const calculateStudentRiskScore = (student) => {
  let score = 0;
  let factors = [];

  // Grade factor (0-35 points)
  if (student.grades && student.grades.length > 0) {
    const avgGrade = student.grades.reduce((a, b) => a + b.grade, 0) / student.grades.length;
    if (avgGrade < 75) { score += 35; factors.push({ label: 'Failing grades', severity: 'critical', detail: `Average: ${avgGrade.toFixed(1)}%` }); }
    else if (avgGrade < 80) { score += 20; factors.push({ label: 'Low grades', severity: 'warning', detail: `Average: ${avgGrade.toFixed(1)}%` }); }
    else if (avgGrade < 85) { score += 10; factors.push({ label: 'Below target grades', severity: 'info', detail: `Average: ${avgGrade.toFixed(1)}%` }); }

    // Grade trend
    if (student.grades.length >= 2) {
      const recent = student.grades.slice(-2);
      const trend = recent[1].grade - recent[0].grade;
      if (trend < -5) { score += 10; factors.push({ label: 'Declining grades', severity: 'warning', detail: `${trend.toFixed(1)} point drop` }); }
      else if (trend > 5) { score -= 5; factors.push({ label: 'Improving grades', severity: 'positive', detail: `+${trend.toFixed(1)} point rise` }); }
    }
  }

  // Attendance factor (0-30 points)
  if (student.attendance) {
    const { total, present, absent, late } = student.attendance;
    if (total > 0) {
      const absenceRate = (absent / total) * 100;
      const lateRate = (late / total) * 100;
      if (absenceRate > 20) { score += 30; factors.push({ label: 'Critical absences', severity: 'critical', detail: `${absenceRate.toFixed(0)}% absent` }); }
      else if (absenceRate > 10) { score += 20; factors.push({ label: 'High absences', severity: 'warning', detail: `${absenceRate.toFixed(0)}% absent` }); }
      else if (absenceRate > 5) { score += 10; factors.push({ label: 'Moderate absences', severity: 'info', detail: `${absenceRate.toFixed(0)}% absent` }); }
      if (lateRate > 15) { score += 5; factors.push({ label: 'Frequent tardiness', severity: 'info', detail: `${lateRate.toFixed(0)}% late` }); }
    }
  }

  // Behavioral factor (0-25 points)
  if (student.behavioral && student.behavioral.length > 0) {
    const majorIncidents = student.behavioral.filter(b => b.severity === 'major' || b.severity === 'critical').length;
    const minorIncidents = student.behavioral.filter(b => b.severity === 'minor').length;
    if (majorIncidents >= 3) { score += 25; factors.push({ label: 'Multiple major incidents', severity: 'critical', detail: `${majorIncidents} major incidents` }); }
    else if (majorIncidents >= 1) { score += 15; factors.push({ label: 'Major incident on record', severity: 'warning', detail: `${majorIncidents} major incident(s)` }); }
    if (minorIncidents >= 5) { score += 10; factors.push({ label: 'Frequent minor incidents', severity: 'warning', detail: `${minorIncidents} minor incidents` }); }
  }

  // Counseling factor (0-10 points)
  if (student.counseling && student.counseling.length > 0) {
    const activeCases = student.counseling.filter(c => c.status === 'ongoing' || c.status === 'active').length;
    if (activeCases > 0) { score += 10; factors.push({ label: 'Active counseling', severity: 'info', detail: `${activeCases} active case(s)` }); }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    level: score >= 70 ? 'critical' : score >= 40 ? 'warning' : score >= 20 ? 'moderate' : 'low',
    factors,
    recommendation: generateRecommendation(score, factors),
  };
};

const generateRecommendation = (score, factors) => {
  if (score >= 70) return 'Immediate intervention required. Schedule parent-teacher conference and refer to guidance counselor.';
  if (score >= 40) return 'Monitor closely. Consider academic support program and regular check-ins.';
  if (score >= 20) return 'Keep observing. Student may benefit from peer tutoring or mentoring.';
  return 'Student is on track. Continue with regular monitoring.';
};

/**
 * Detect attendance anomalies using statistical analysis
 */
export const detectAttendanceAnomalies = (attendanceData, options = {}) => {
  const { windowSize = 5, threshold = 2 } = options;
  const anomalies = [];

  if (!attendanceData || attendanceData.length < windowSize) return anomalies;

  // Sort by date
  const sorted = [...attendanceData].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate rolling absence rate
  for (let i = windowSize; i < sorted.length; i++) {
    const window = sorted.slice(i - windowSize, i);
    const windowAbsences = window.filter(d => d.status === 'absent').length;
    const windowRate = windowAbsences / windowSize;

    // Compare with overall rate
    const totalAbsences = sorted.slice(0, i).filter(d => d.status === 'absent').length;
    const overallRate = totalAbsences / i;

    if (windowRate > overallRate * threshold && windowAbsences >= 2) {
      anomalies.push({
        type: 'spike',
        startDate: window[0].date,
        endDate: window[window.length - 1].date,
        windowRate: (windowRate * 100).toFixed(0),
        overallRate: (overallRate * 100).toFixed(0),
        description: `Absence spike detected: ${(windowRate * 100).toFixed(0)}% in ${windowSize}-day window vs ${(overallRate * 100).toFixed(0)}% overall`,
      });
    }
  }

  // Detect consecutive absences
  let consecutive = 0;
  let streakStart = null;
  sorted.forEach((record, i) => {
    if (record.status === 'absent') {
      if (consecutive === 0) streakStart = record.date;
      consecutive++;
      if (consecutive >= 3) {
        anomalies.push({
          type: 'consecutive',
          startDate: streakStart,
          endDate: record.date,
          count: consecutive,
          description: `${consecutive} consecutive absences starting ${new Date(streakStart).toLocaleDateString()}`,
        });
      }
    } else {
      consecutive = 0;
    }
  });

  // Detect day-of-week patterns
  const dayAbsences = [0, 0, 0, 0, 0];
  const dayCounts = [0, 0, 0, 0, 0];
  sorted.forEach(record => {
    const day = new Date(record.date).getDay();
    if (day >= 1 && day <= 5) {
      dayCounts[day - 1]++;
      if (record.status === 'absent') dayAbsences[day - 1]++;
    }
  });

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const avgRate = sorted.filter(d => d.status === 'absent').length / sorted.length;
  dayAbsences.forEach((abs, i) => {
    if (dayCounts[i] > 3) {
      const dayRate = abs / dayCounts[i];
      if (dayRate > avgRate * 2 && abs >= 3) {
        anomalies.push({
          type: 'pattern',
          day: dayNames[i],
          rate: (dayRate * 100).toFixed(0),
          description: `${dayNames[i]} absence pattern: ${(dayRate * 100).toFixed(0)}% vs ${(avgRate * 100).toFixed(0)}% average`,
        });
      }
    }
  });

  return anomalies;
};

/**
 * Predict final grade using weighted moving average
 */
export const predictFinalGrade = (quarterGrades) => {
  if (!quarterGrades || quarterGrades.length === 0) return null;

  // Weights: more recent quarters matter more
  const weights = [0.15, 0.2, 0.3, 0.35];
  let weightedSum = 0;
  let totalWeight = 0;

  quarterGrades.forEach((grade, i) => {
    const w = weights[i] || weights[weights.length - 1];
    weightedSum += grade * w;
    totalWeight += w;
  });

  const predicted = weightedSum / totalWeight;

  // Calculate trend
  let trend = 'stable';
  if (quarterGrades.length >= 2) {
    const diff = quarterGrades[quarterGrades.length - 1] - quarterGrades[quarterGrades.length - 2];
    if (diff > 3) trend = 'improving';
    else if (diff < -3) trend = 'declining';
  }

  // Calculate confidence
  const variance = quarterGrades.reduce((acc, g) => acc + Math.pow(g - predicted, 2), 0) / quarterGrades.length;
  const confidence = Math.max(0.4, Math.min(0.95, 1 - (variance / 100)));

  return {
    predicted: Math.round(predicted * 10) / 10,
    trend,
    confidence: Math.round(confidence * 100),
    willPass: predicted >= 75,
    remark: predicted >= 90 ? 'Outstanding' : predicted >= 85 ? 'Very Satisfactory' : predicted >= 80 ? 'Satisfactory' : predicted >= 75 ? 'Fairly Satisfactory' : 'Did Not Meet Expectations',
  };
};

/**
 * Generate class-level analytics
 */
export const generateClassAnalytics = (students) => {
  if (!students || students.length === 0) return null;

  const totalStudents = students.length;
  const withGrades = students.filter(s => s.grades && s.grades.length > 0);
  const averages = withGrades.map(s => s.grades.reduce((a, b) => a + b.grade, 0) / s.grades.length);

  const classAvg = averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : 0;
  const passing = averages.filter(a => a >= 75).length;
  const failing = averages.filter(a => a < 75).length;

  // Distribution
  const distribution = {
    outstanding: averages.filter(a => a >= 90).length,
    verySatisfactory: averages.filter(a => a >= 85 && a < 90).length,
    satisfactory: averages.filter(a => a >= 80 && a < 85).length,
    fairlySatisfactory: averages.filter(a => a >= 75 && a < 80).length,
    didNotMeet: averages.filter(a => a < 75).length,
  };

  // Standard deviation
  const stdDev = Math.sqrt(averages.reduce((acc, a) => acc + Math.pow(a - classAvg, 2), 0) / Math.max(averages.length, 1));

  return {
    totalStudents,
    classAverage: classAvg.toFixed(1),
    passingRate: ((passing / Math.max(withGrades.length, 1)) * 100).toFixed(1),
    failing,
    distribution,
    standardDeviation: stdDev.toFixed(1),
    homogeneity: stdDev < 5 ? 'Homogeneous' : stdDev < 10 ? 'Moderate' : 'Heterogeneous',
  };
};

/**
 * Smart enrollment forecasting
 */
export const forecastEnrollment = (historicalData) => {
  if (!historicalData || historicalData.length < 2) return null;

  // Simple linear regression
  const n = historicalData.length;
  const xSum = historicalData.reduce((a, _, i) => a + i, 0);
  const ySum = historicalData.reduce((a, d) => a + d.count, 0);
  const xySum = historicalData.reduce((a, d, i) => a + i * d.count, 0);
  const x2Sum = historicalData.reduce((a, _, i) => a + i * i, 0);

  const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
  const intercept = (ySum - slope * xSum) / n;

  const predicted = Math.round(slope * n + intercept);
  const growthRate = ((slope / (ySum / n)) * 100).toFixed(1);

  return {
    predicted,
    growthRate: parseFloat(growthRate),
    trend: slope > 0 ? 'growing' : slope < 0 ? 'declining' : 'stable',
    confidence: Math.min(95, Math.max(50, 70 + n * 5)),
  };
};

/**
 * Generate AI-powered insights summary
 */
export const generateInsightsSummary = (data) => {
  const insights = [];
  const { students, attendance, grades, payments } = data;

  // Student risk insights
  if (students) {
    const atRisk = students.filter(s => s.riskScore >= 40).length;
    const critical = students.filter(s => s.riskScore >= 70).length;
    if (critical > 0) {
      insights.push({
        type: 'critical',
        icon: '🚨',
        title: `${critical} student${critical > 1 ? 's' : ''} need immediate attention`,
        description: 'Critical risk scores detected. Recommend scheduling interventions this week.',
        action: 'View at-risk students',
        actionLink: '/students?filter=at-risk',
      });
    }
    if (atRisk > 0) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: `${atRisk} student${atRisk > 1 ? 's' : ''} showing warning signs`,
        description: 'Monitor these students closely for academic and behavioral changes.',
        action: 'Review warnings',
        actionLink: '/students?filter=warning',
      });
    }
  }

  // Attendance insights
  if (attendance) {
    const todayPresent = attendance.todayPresent || 0;
    const todayTotal = attendance.todayTotal || 0;
    const rate = todayTotal > 0 ? (todayPresent / todayTotal * 100) : 0;
    if (rate < 85 && todayTotal > 0) {
      insights.push({
        type: 'warning',
        icon: '📊',
        title: `Today's attendance is ${rate.toFixed(0)}%`,
        description: `Only ${todayPresent} of ${todayTotal} students present. Below the 85% target.`,
        action: 'Check attendance',
        actionLink: '/attendance',
      });
    }
  }

  // Payment insights
  if (payments) {
    const overdue = payments.overdue || 0;
    if (overdue > 0) {
      insights.push({
        type: 'info',
        icon: '💰',
        title: `${overdue} overdue payment${overdue > 1 ? 's' : ''}`,
        description: 'Send reminders to parents with outstanding balances.',
        action: 'View payments',
        actionLink: '/fees',
      });
    }
  }

  return insights;
};

export default {
  calculateStudentRiskScore,
  detectAttendanceAnomalies,
  predictFinalGrade,
  generateClassAnalytics,
  forecastEnrollment,
  generateInsightsSummary,
};
