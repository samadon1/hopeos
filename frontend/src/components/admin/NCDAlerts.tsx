"use client"

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Heart,
  Activity,
  Pill,
  TestTube,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from 'lucide-react';

// Alert severity levels
type AlertSeverity = 'critical' | 'warning' | 'info';

interface CDSAlert {
  id: string;
  severity: AlertSeverity;
  category: 'diabetes' | 'hypertension' | 'ckd' | 'cvd' | 'medication' | 'screening' | 'general';
  title: string;
  description: string;
  action?: string;
  value?: string;
  target?: string;
}

interface NCDAlertsProps {
  patientData: {
    patient?: {
      person?: {
        age?: number;
        gender?: string;
      };
    };
    vitals?: any[];
    medications?: any[];
    pharmacyOrders?: any[];
    labTests?: any[];
    labOrders?: any[];
    labResults?: any[];
    encounters?: any[];
    diagnoses?: any[];
    allergies?: any[];
  };
}

// NCD-related diagnosis keywords
const NCD_KEYWORDS = {
  diabetes: ['diabetes', 'diabetic', 'dm', 'type 1', 'type 2', 't1dm', 't2dm', 'hyperglycemia', 'glucose'],
  hypertension: ['hypertension', 'htn', 'high blood pressure', 'elevated bp', 'hypertensive'],
  ckd: ['chronic kidney', 'ckd', 'renal failure', 'kidney disease', 'nephropathy', 'egfr'],
  cvd: ['cardiovascular', 'heart disease', 'coronary', 'cad', 'heart failure', 'chf', 'angina', 'mi', 'stroke'],
  copd: ['copd', 'chronic obstructive', 'emphysema', 'chronic bronchitis'],
  asthma: ['asthma', 'reactive airway'],
};

// Check if patient has a specific NCD
const hasCondition = (diagnoses: any[], keywords: string[]): boolean => {
  if (!diagnoses || diagnoses.length === 0) return false;

  return diagnoses.some((dx: any) => {
    // Handle both camelCase and snake_case field names from backend
    const text = (dx.conditionText || dx.condition_text || dx.display || dx.name || '').toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  });
};

// Parse vital value
const parseVitalValue = (vitals: any[], type: string): number | null => {
  if (!vitals || vitals.length === 0) return null;

  const vital = vitals.find((v: any) => {
    // Handle both camelCase and snake_case from backend
    const name = (v.type || v.concept_display || v.concept?.display || v.display || v.name || '').toLowerCase();
    return name.includes(type.toLowerCase());
  });

  if (!vital) return null;

  // Handle both camelCase and snake_case
  const value = vital.value || vital.valueNumeric || vital.value_numeric;
  return typeof value === 'number' ? value : parseFloat(value);
};

// Parse BP value (returns {systolic, diastolic})
const parseBPValue = (vitals: any[]): { systolic: number; diastolic: number } | null => {
  if (!vitals || vitals.length === 0) return null;

  const systolic = parseVitalValue(vitals, 'systolic');
  const diastolic = parseVitalValue(vitals, 'diastolic');

  if (systolic && diastolic) {
    return { systolic, diastolic };
  }

  // Try parsing combined BP format
  const bpVital = vitals.find((v: any) => {
    const name = (v.type || v.concept_display || v.concept?.display || v.display || '').toLowerCase();
    return name.includes('blood pressure') || name === 'bp';
  });

  if (bpVital) {
    const value = String(bpVital.value || '');
    const match = value.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      return { systolic: parseInt(match[1]), diastolic: parseInt(match[2]) };
    }
  }

  return null;
};

// Get most recent lab value
const getLabValue = (labs: any[], testNames: string[]): { value: number; date: string } | null => {
  if (!labs || labs.length === 0) return null;

  const lab = labs.find((l: any) => {
    // Handle both camelCase and snake_case from backend
    const name = (l.testType || l.test_type || l.testName || l.concept?.display || l.display || '').toLowerCase();
    return testNames.some(t => name.includes(t.toLowerCase()));
  });

  if (!lab) return null;

  // Handle both camelCase and snake_case
  const value = lab.resultValue || lab.result_value || lab.value || lab.valueNumeric || lab.value_numeric;
  const numValue = typeof value === 'number' ? value : parseFloat(value);

  if (isNaN(numValue)) return null;

  return {
    value: numValue,
    date: lab.resultDate || lab.result_date || lab.date || lab.obsDatetime || lab.obs_datetime || '',
  };
};

// Calculate days since date
const daysSince = (dateStr: string): number | null => {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

// Generate NCD alerts based on patient data
const generateAlerts = (patientData: NCDAlertsProps['patientData']): CDSAlert[] => {
  const alerts: CDSAlert[] = [];

  const diagnoses = patientData.diagnoses || [];
  const vitals = patientData.vitals || [];
  const labs = patientData.labOrders || patientData.labTests || patientData.labResults || [];
  const medications = patientData.pharmacyOrders || patientData.medications || [];
  const allergies = patientData.allergies || [];
  const encounters = patientData.encounters || [];

  const hasDiabetes = hasCondition(diagnoses, NCD_KEYWORDS.diabetes);
  const hasHTN = hasCondition(diagnoses, NCD_KEYWORDS.hypertension);
  const hasCKD = hasCondition(diagnoses, NCD_KEYWORDS.ckd);
  const hasCVD = hasCondition(diagnoses, NCD_KEYWORDS.cvd);

  // ============================================================================
  // CRITICAL ALERTS (Red) - Immediate attention needed
  // ============================================================================

  // Critical BP
  const bp = parseBPValue(vitals);
  if (bp) {
    if (bp.systolic >= 180 || bp.diastolic >= 120) {
      alerts.push({
        id: 'critical-bp',
        severity: 'critical',
        category: 'hypertension',
        title: 'Hypertensive Crisis',
        description: `BP ${bp.systolic}/${bp.diastolic} mmHg requires immediate evaluation`,
        value: `${bp.systolic}/${bp.diastolic}`,
        target: '<180/120',
        action: 'Assess for end-organ damage',
      });
    } else if (hasHTN && (bp.systolic >= 160 || bp.diastolic >= 100)) {
      alerts.push({
        id: 'uncontrolled-htn',
        severity: 'critical',
        category: 'hypertension',
        title: 'Uncontrolled Hypertension',
        description: `BP ${bp.systolic}/${bp.diastolic} mmHg significantly above target`,
        value: `${bp.systolic}/${bp.diastolic}`,
        target: '<140/90',
        action: 'Consider treatment intensification',
      });
    }
  }

  // Critical glucose
  const glucose = parseVitalValue(vitals, 'glucose') || parseVitalValue(vitals, 'blood sugar') || parseVitalValue(vitals, 'rbs') || parseVitalValue(vitals, 'fbs');
  if (glucose) {
    if (glucose < 70) {
      alerts.push({
        id: 'hypoglycemia',
        severity: 'critical',
        category: 'diabetes',
        title: 'Hypoglycemia',
        description: `Glucose ${glucose} mg/dL - requires immediate intervention`,
        value: `${glucose}`,
        target: '70-180',
        action: 'Administer glucose, review medications',
      });
    } else if (glucose > 400) {
      alerts.push({
        id: 'severe-hyperglycemia',
        severity: 'critical',
        category: 'diabetes',
        title: 'Severe Hyperglycemia',
        description: `Glucose ${glucose} mg/dL - assess for DKA/HHS`,
        value: `${glucose}`,
        target: '70-180',
        action: 'Check ketones, hydration status',
      });
    }
  }

  // Critical potassium (if CKD)
  const potassium = getLabValue(labs, ['potassium', 'k+']);
  if (potassium && potassium.value >= 6.0) {
    alerts.push({
      id: 'critical-k',
      severity: 'critical',
      category: 'ckd',
      title: 'Critical Hyperkalemia',
      description: `K+ ${potassium.value} mEq/L - cardiac risk`,
      value: `${potassium.value}`,
      target: '3.5-5.0',
      action: 'ECG, calcium gluconate if symptomatic',
    });
  }

  // ============================================================================
  // WARNING ALERTS (Yellow) - Needs attention
  // ============================================================================

  // Uncontrolled diabetes
  const hba1c = getLabValue(labs, ['hba1c', 'a1c', 'glycated', 'hemoglobin a1c']);
  if (hasDiabetes && hba1c) {
    if (hba1c.value > 9) {
      alerts.push({
        id: 'poorly-controlled-dm',
        severity: 'warning',
        category: 'diabetes',
        title: 'Poorly Controlled Diabetes',
        description: `HbA1c ${hba1c.value}% indicates poor glycemic control`,
        value: `${hba1c.value}%`,
        target: '<7%',
        action: 'Intensify treatment, assess adherence',
      });
    } else if (hba1c.value > 7) {
      alerts.push({
        id: 'above-target-dm',
        severity: 'warning',
        category: 'diabetes',
        title: 'Above Target HbA1c',
        description: `HbA1c ${hba1c.value}% - above target for most patients`,
        value: `${hba1c.value}%`,
        target: '<7%',
        action: 'Consider treatment adjustment',
      });
    }
  }

  // Elevated BP in HTN patient (not critical)
  if (bp && hasHTN && bp.systolic >= 140 && bp.systolic < 160 && bp.diastolic < 100) {
    alerts.push({
      id: 'elevated-bp',
      severity: 'warning',
      category: 'hypertension',
      title: 'BP Above Target',
      description: `BP ${bp.systolic}/${bp.diastolic} mmHg - not at goal`,
      value: `${bp.systolic}/${bp.diastolic}`,
      target: '<140/90',
      action: 'Review medications and adherence',
    });
  }

  // Declining kidney function
  const egfr = getLabValue(labs, ['egfr', 'gfr']);
  if (egfr) {
    if (egfr.value < 30 && !hasCKD) {
      alerts.push({
        id: 'low-egfr',
        severity: 'warning',
        category: 'ckd',
        title: 'Reduced Kidney Function',
        description: `eGFR ${egfr.value} mL/min - Stage 4 CKD range`,
        value: `${egfr.value}`,
        target: '>60',
        action: 'Nephrology referral recommended',
      });
    } else if (egfr.value < 60 && egfr.value >= 30) {
      alerts.push({
        id: 'moderate-ckd',
        severity: 'info',
        category: 'ckd',
        title: 'Moderate CKD',
        description: `eGFR ${egfr.value} mL/min - monitor nephrotoxic drugs`,
        value: `${egfr.value}`,
        target: '>60',
        action: 'Avoid NSAIDs, adjust renally-cleared drugs',
      });
    }
  }

  // Elevated LDL in CVD patient
  const ldl = getLabValue(labs, ['ldl', 'low density']);
  if ((hasCVD || hasDiabetes) && ldl && ldl.value > 100) {
    alerts.push({
      id: 'elevated-ldl',
      severity: 'warning',
      category: 'cvd',
      title: 'LDL Above Target',
      description: `LDL ${ldl.value} mg/dL - high risk patient target is <70-100`,
      value: `${ldl.value}`,
      target: '<100',
      action: 'Optimize statin therapy',
    });
  }

  // ============================================================================
  // INFO ALERTS (Blue) - Care gaps and reminders
  // ============================================================================

  // Overdue HbA1c for diabetics
  if (hasDiabetes) {
    if (!hba1c) {
      alerts.push({
        id: 'no-hba1c',
        severity: 'info',
        category: 'screening',
        title: 'HbA1c Not Found',
        description: 'No recent HbA1c on record for diabetic patient',
        action: 'Order HbA1c (every 3-6 months)',
      });
    } else {
      const daysAgo = daysSince(hba1c.date);
      if (daysAgo && daysAgo > 90) {
        alerts.push({
          id: 'overdue-hba1c',
          severity: 'info',
          category: 'screening',
          title: 'HbA1c Overdue',
          description: `Last HbA1c was ${Math.floor(daysAgo / 30)} months ago`,
          action: 'Order HbA1c (every 3 months if uncontrolled)',
        });
      }
    }
  }

  // Allergy reminder
  if (allergies && allergies.length > 0) {
    const allergyList = allergies
      .slice(0, 3)
      .map((a: any) => a.allergen || a.display || a.name || 'Unknown')
      .join(', ');
    alerts.push({
      id: 'allergies',
      severity: 'info',
      category: 'general',
      title: 'Known Allergies',
      description: allergyList + (allergies.length > 3 ? ` (+${allergies.length - 3} more)` : ''),
      action: 'Review before prescribing',
    });
  }

  // Active medications count
  if (medications && medications.length >= 5) {
    alerts.push({
      id: 'polypharmacy',
      severity: 'info',
      category: 'medication',
      title: 'Polypharmacy',
      description: `${medications.length} active medications - review for interactions`,
      action: 'Consider medication reconciliation',
    });
  }

  // No recent visit
  if (encounters && encounters.length > 0) {
    const lastEncounter = encounters[0];
    const lastDate = lastEncounter.encounterDatetime || lastEncounter.date;
    const daysAgo = daysSince(lastDate);

    if ((hasDiabetes || hasHTN) && daysAgo && daysAgo > 90) {
      alerts.push({
        id: 'overdue-visit',
        severity: 'info',
        category: 'screening',
        title: 'Follow-up Overdue',
        description: `Last visit was ${Math.floor(daysAgo / 30)} months ago`,
        action: 'Schedule follow-up for NCD monitoring',
      });
    }
  }

  return alerts;
};

// Alert icon by category
const getCategoryIcon = (category: CDSAlert['category']) => {
  switch (category) {
    case 'diabetes':
      return <Activity className="h-3.5 w-3.5" />;
    case 'hypertension':
    case 'cvd':
      return <Heart className="h-3.5 w-3.5" />;
    case 'ckd':
      return <TestTube className="h-3.5 w-3.5" />;
    case 'medication':
      return <Pill className="h-3.5 w-3.5" />;
    case 'screening':
      return <Calendar className="h-3.5 w-3.5" />;
    default:
      return <Info className="h-3.5 w-3.5" />;
  }
};

// Severity styles - professional medical aesthetic
const getSeverityStyles = (severity: AlertSeverity) => {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-rose-50/80',
        border: 'border-rose-200/60',
        icon: 'text-rose-600',
        text: 'text-rose-900',
        subtext: 'text-rose-700',
        badge: 'bg-rose-100/80 text-rose-700 border border-rose-200/50',
      };
    case 'warning':
      return {
        bg: 'bg-amber-50/60',
        border: 'border-amber-200/50',
        icon: 'text-amber-600',
        text: 'text-amber-900',
        subtext: 'text-amber-700',
        badge: 'bg-amber-100/70 text-amber-700 border border-amber-200/50',
      };
    case 'info':
      return {
        bg: 'bg-slate-50/80',
        border: 'border-slate-200/60',
        icon: 'text-slate-500',
        text: 'text-slate-800',
        subtext: 'text-slate-600',
        badge: 'bg-slate-100 text-slate-600 border border-slate-200/60',
      };
  }
};

export default function NCDAlerts({ patientData }: NCDAlertsProps) {
  const [alerts, setAlerts] = useState<CDSAlert[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const generatedAlerts = generateAlerts(patientData);
    setAlerts(generatedAlerts);
  }, [patientData]);

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));
  const criticalCount = visibleAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = visibleAlerts.filter(a => a.severity === 'warning').length;
  const infoCount = visibleAlerts.filter(a => a.severity === 'info').length;

  if (visibleAlerts.length === 0) {
    return null;
  }

  // Sort: critical first, then warning, then info
  const sortedAlerts = [...visibleAlerts].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="mb-6">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-t-xl cursor-pointer hover:bg-slate-50/50 transition-colors shadow-sm"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-slate-100">
              <AlertTriangle className="h-3.5 w-3.5 text-slate-600" />
            </div>
            <span className="text-sm font-semibold text-slate-800">Clinical Alerts</span>
          </div>
          <div className="flex items-center gap-1.5">
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-rose-100/80 text-rose-700 rounded-full border border-rose-200/50">
                {criticalCount} Critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100/70 text-amber-700 rounded-full border border-amber-200/50">
                {warningCount} Warning
              </span>
            )}
            {infoCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full border border-slate-200/60">
                {infoCount} Info
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </div>

      {/* Alerts List */}
      {expanded && (
        <div className="border border-t-0 border-slate-200 rounded-b-xl overflow-hidden bg-white shadow-sm">
          {sortedAlerts.map((alert, index) => {
            const styles = getSeverityStyles(alert.severity);

            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 px-4 py-3.5 ${styles.bg} ${index > 0 ? 'border-t border-slate-100' : ''}`}
              >
                {/* Severity Icon */}
                <div className={`flex-shrink-0 mt-0.5 p-1 rounded ${alert.severity === 'critical' ? 'bg-rose-100/60' : alert.severity === 'warning' ? 'bg-amber-100/50' : 'bg-slate-100/80'}`}>
                  {alert.severity === 'critical' ? (
                    <AlertCircle className={`h-3.5 w-3.5 ${styles.icon}`} />
                  ) : alert.severity === 'warning' ? (
                    <AlertTriangle className={`h-3.5 w-3.5 ${styles.icon}`} />
                  ) : (
                    <Info className={`h-3.5 w-3.5 ${styles.icon}`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-sm font-medium ${styles.text}`}>
                      {alert.title}
                    </span>
                    {alert.value && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-medium ${styles.badge}`}>
                        {alert.value} {alert.target && <span className="opacity-70">→ {alert.target}</span>}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${styles.subtext}`}>
                    {alert.description}
                  </p>
                  {alert.action && (
                    <p className={`text-xs mt-1.5 font-medium ${styles.text} flex items-center gap-1`}>
                      <span className="text-slate-400">→</span> {alert.action}
                    </p>
                  )}
                </div>

                {/* Category Badge & Dismiss */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md ${styles.badge}`}>
                    {getCategoryIcon(alert.category)}
                    <span className="capitalize font-medium">{alert.category}</span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissed(prev => new Set([...prev, alert.id]));
                    }}
                    className="p-1.5 rounded-md hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-600"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
