import React from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { SENSOR_META, formatDateTime } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

export default function SensorChart({ sensorType, points }) {
  const { t } = useI18n();
  const meta = SENSOR_META[sensorType] || { label: sensorType, unitLabel: "", color: "#15803d" };
  const data = (points || []).map((point) => ({ at: formatDateTime(point.recorded_at), value: point.value }));

  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("No readings stored for this sensor yet.")}
      </p>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="at"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            interval="preserveStartEnd"
            minTickGap={32}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={46} tickLine={false} />
          <RechartsTooltip
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
            formatter={(value) => [`${value} ${meta.unitLabel}`, t(meta.label)]}
          />
          <Line type="monotone" dataKey="value" stroke={meta.color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}