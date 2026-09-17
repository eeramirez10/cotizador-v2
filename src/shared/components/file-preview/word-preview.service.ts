import type { FilePreviewResult } from "./file-preview.types";

export class WordPreviewService {
  static async convert(arrayBuffer: ArrayBuffer): Promise<Extract<FilePreviewResult, { kind: "word" }>> {
    const [mammothModule, domPurifyModule] = await Promise.all([
      import("mammoth"),
      import("dompurify"),
    ]);
    const mammoth = mammothModule.default;
    const DOMPurify = domPurifyModule.default;
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      { convertImage: mammoth.images.dataUri },
    );
    return {
      kind: "word",
      html: DOMPurify.sanitize(result.value, { USE_PROFILES: { html: true } }),
      warnings: result.messages.map((message) => message.message),
    };
  }
}
