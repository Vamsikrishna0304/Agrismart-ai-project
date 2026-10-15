import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

export default function FarmSelect({ farms, value, onChange, placeholder = "Select a farm", allowAll = false, disabled = false }) {
  const { t } = useI18n();

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t(placeholder)} />
      </SelectTrigger>
      <SelectContent>
        {allowAll ? <SelectItem value="all">{t("All farms")}</SelectItem> : null}
        {farms.map((farm) => (
          <SelectItem key={farm.id} value={farm.id}>
            {farm.name}
            {farm.location ? ` · ${farm.location}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}