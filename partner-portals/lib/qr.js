const QRCode = require('qrcode');

const QR_OPTIONS = {
  errorCorrectionLevel: 'M',
  margin: 2,
  width: 320,
  color: {
    dark: '#111827',
    light: '#ffffff'
  }
};

async function createQrImage(payload) {
  return QRCode.toDataURL(payload, QR_OPTIONS);
}

async function attachQrImages(items, getPayload) {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      qr_image: await createQrImage(getPayload(item))
    }))
  );
}

module.exports = {
  attachQrImages,
  createQrImage
};
