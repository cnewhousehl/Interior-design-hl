/** Format feet as feet/inches, e.g. 3.5 -> 3'6" */
export function formatFeet(feet: number): string {
  if (!isFinite(feet)) return "—";
  const sign = feet < 0 ? "-" : "";
  const abs = Math.abs(feet);
  const ft = Math.floor(abs);
  const inches = Math.round((abs - ft) * 12);
  if (inches === 12) return `${sign}${ft + 1}'0"`;
  return `${sign}${ft}'${inches}"`;
}

export function formatSqft(sqft: number): string {
  return `${sqft.toFixed(1)} sq ft`;
}
