export const MAX_X_AXIS_LABELS = 7;

export function selectXAxisLabelIndexes(labelCount, maxLabels = MAX_X_AXIS_LABELS) {
  const total = Math.max(0, Number(labelCount) || 0);
  const limit = Math.max(1, Math.min(total || 1, Number(maxLabels) || MAX_X_AXIS_LABELS));
  if (total === 0) return new Set();
  if (limit === 1) return new Set([0]);

  return new Set(
    Array.from({ length: limit }, (_, index) => (
      Math.round(index * (total - 1) / (limit - 1))
    )),
  );
}
