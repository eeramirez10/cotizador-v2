import { useEffect, useRef, useState } from "react";
import { FilePreviewService } from "./file-preview.service";
import type { FilePreviewResult, UseFilePreviewOptions } from "./file-preview.types";

export const useFilePreview = ({ file, getBlob }: UseFilePreviewOptions) => {
  const [preview, setPreview] = useState<FilePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const getBlobRef = useRef(getBlob);

  useEffect(() => {
    getBlobRef.current = getBlob;
  }, [getBlob]);

  useEffect(() => {
    let active = true;
    let generated: FilePreviewResult | null = null;
    if (!file) return undefined;

    void Promise.resolve().then(async () => {
      if (!active) return;
      setPreview(null);
      setError("");
      setLoading(true);
      try {
        const blob = await getBlobRef.current(file);
        const result = await FilePreviewService.create(file, blob);
        generated = result;
        if (active) setPreview(result);
        else FilePreviewService.revoke(result);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "No se pudo preparar la vista previa.");
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      FilePreviewService.revoke(generated);
    };
  }, [file]);

  return { preview, loading, error };
};
