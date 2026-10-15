import React, { useEffect, useState } from "react";
import { Image } from "@/components/ui/image";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";

export default function PrivateImage({ fileUri, alt, className = "", fittingType = "fill" }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!fileUri) return undefined;
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 3600 })
      .then((response) => {
        if (active) setUrl(response.signed_url);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [fileUri]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted px-3 text-center text-xs text-muted-foreground ${className}`}>
        {t("Image could not be opened: {error}", { error })}
      </div>
    );
  }

  if (!url) return <div className={`animate-pulse bg-muted ${className}`} />;

  return <Image src={url} alt={alt} className={className} fittingType={fittingType} />;
}