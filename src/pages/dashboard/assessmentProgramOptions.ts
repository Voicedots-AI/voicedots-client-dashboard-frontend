/** Display institution-owned names while preserving the stored filter identifiers. */
export function assessmentProgramOptions(
  catalog: readonly {code: string; display_name?: string | null}[],
  rosterPrograms: readonly (string | null | undefined)[],
) {
  if (catalog.length) return catalog.map(program => ({
    value: program.code,
    label: program.display_name?.trim() || `Program name not recorded (${program.code})`,
  }));
  return [...new Set(rosterPrograms.filter((program): program is string => Boolean(program)))].map(value => ({value, label: value}));
}
