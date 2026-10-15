export const SOURCE_OPTIONS = [
  { value: "lab_measured", label: "Soil testing lab (measured)" },
  { value: "field_sensor", label: "Field sensor or kit (measured)" },
  { value: "estimated", label: "Estimated from experience" },
];

export const SOURCE_LABELS = {
  lab_measured: { label: "Soil testing lab", tone: "ok" },
  field_sensor: { label: "Field sensor", tone: "ok" },
  estimated: { label: "Estimated", tone: "warning" },
};