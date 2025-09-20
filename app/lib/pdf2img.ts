// app/lib/pdf2img.ts
// ⚡ No "use client" here → this stays SSR-safe
// We’ll export a browser-only loader instead.

export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

// Wrapper to dynamically load pdf.js only on client
export async function convertPdfToImage(
  file: File
): Promise<PdfConversionResult> {
  if (typeof window === "undefined") {
    // Running on server → block
    return {
      imageUrl: "",
      file: null,
      error: "PDF conversion is only supported in the browser.",
    };
  }

  try {
    // ✅ Dynamically import pdf.js and worker only in browser
    // @ts-expect-error - no types
    const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");

    const pdfWorker = await import(
      "pdfjs-dist/build/pdf.worker.min.mjs?url"
      );

    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // only first page for now

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    }

    await page.render({ canvasContext: context!, viewport }).promise;

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const originalName = file.name.replace(/\.pdf$/i, "");
            const imageFile = new File([blob], `${originalName}.png`, {
              type: "image/png",
            });

            resolve({
              imageUrl: URL.createObjectURL(blob),
              file: imageFile,
            });
          } else {
            resolve({
              imageUrl: "",
              file: null,
              error: "Failed to create image blob",
            });
          }
        },
        "image/png",
        1.0
      );
    });
  } catch (err) {
    return {
      imageUrl: "",
      file: null,
      error: `Failed to convert PDF: ${err}`,
    };
  }
}
