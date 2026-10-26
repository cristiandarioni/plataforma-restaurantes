import QRCode from "qrcode";

/** QR en SVG con corrección de errores alta: sigue leyéndose aunque el soporte se raye o se grabe con láser. */
export function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H", margin: 2 });
}

export function tableUrl(base: string, code: string) {
  return `${base}/q/${code}`;
}
