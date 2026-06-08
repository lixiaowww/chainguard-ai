/**
 * HarnessHelper.ts
 * Type-safe port of masking, sanitization, and output guardrails helpers for testing.
 */

export function maskSensitiveData(text: string): string {
  if (!text) return "";
  let masked = text.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})/g, (match, emailUser, emailDomain, emailExt) => {
    return emailUser[0] + "***" + emailUser[emailUser.length - 1] + "@" + emailDomain + "." + emailExt;
  });
  masked = masked.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[PHONE_MASKED]");
  return masked;
}

export function sanitizeTelemetry(points: any[]): any[] {
  if (!Array.isArray(points)) return [];
  return points.map((pt, idx) => {
    const sanitized = { ...pt };
    if (sanitized.temperature === undefined || sanitized.temperature === null || isNaN(Number(sanitized.temperature))) {
      sanitized.temperature = 4;
    } else {
      const temp = Number(sanitized.temperature);
      if (temp > 80) {
        sanitized.temperature = 80;
        console.warn(`Harness Ingestion Sanitizer: Clamped outlier temp ${temp}°C to 80°C at index ${idx}`);
      } else if (temp < -100) {
        sanitized.temperature = -100;
        console.warn(`Harness Ingestion Sanitizer: Clamped outlier temp ${temp}°C to -100°C at index ${idx}`);
      } else {
        sanitized.temperature = temp;
      }
    }
    if (sanitized.humidity === undefined || sanitized.humidity === null || isNaN(Number(sanitized.humidity))) {
      sanitized.humidity = 70;
    } else {
      const hum = Number(sanitized.humidity);
      sanitized.humidity = Math.max(0, Math.min(100, hum));
    }
    if (sanitized.shock_g === undefined || sanitized.shock_g === null || isNaN(Number(sanitized.shock_g))) {
      sanitized.shock_g = 0.1;
    } else {
      const shock = Number(sanitized.shock_g);
      sanitized.shock_g = Math.max(0, Math.min(25, shock));
    }
    return sanitized;
  });
}

export function applyOutputGuardrails(parsedReport: any, commercialValueUsd: number): any {
  if (!parsedReport) return parsedReport;
  const declaredVal = Number(commercialValueUsd || 0);
  if (parsedReport.damage_assessment) {
    const damage = parsedReport.damage_assessment;
    if (damage.estimated_loss_usd > declaredVal) {
      console.warn(`Harness guardrail: Clamped estimated loss of $${damage.estimated_loss_usd} to declared commercial value $${declaredVal}`);
      damage.estimated_loss_usd = declaredVal;
    }
  }
  return parsedReport;
}
