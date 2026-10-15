import React from "react";
import { CloudRain, Droplets, ThermometerSun, Wind } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function WeatherTiles({ data }) {
  const { t } = useI18n();
  const { current, rain } = data;

  const tiles = [
    { Icon: ThermometerSun, label: "Temperature", value: current.temperature_c, suffix: " °C" },
    { Icon: Droplets, label: "Humidity", value: current.humidity_percent, suffix: "%" },
    { Icon: CloudRain, label: "Rain next 24 h", value: rain.next_24h_mm, suffix: " mm" },
    { Icon: CloudRain, label: "Rain next 72 h", value: rain.next_72h_mm, suffix: " mm" },
    { Icon: Wind, label: "Wind", value: current.wind_kmh, suffix: " km/h" },
  ];

  return (
    <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map(({ Icon, label, value, suffix }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Icon className="h-3.5 w-3.5" /> {t(label)}
          </dt>
          <dd className="mt-1 font-display text-base text-foreground">
            {value === null || value === undefined ? "—" : `${value}${suffix}`}
          </dd>
        </div>
      ))}
    </dl>
  );
}