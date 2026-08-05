const ZIP_MAGIC = [0x50, 0x4b];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const GIF87A = Buffer.from('GIF87a', 'ascii');
const GIF89A = Buffer.from('GIF89a', 'ascii');
const RIFF = Buffer.from('RIFF', 'ascii');
const WEBP = Buffer.from('WEBP', 'ascii');

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
    if (buffer.length < bytes.length) {
        return false;
    }

    return bytes.every((byte, index) => buffer[index] === byte);
}

function isUtf8TextLike(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
    const text = sample.toString('utf8').replace(/^\uFEFF/, '');

    if (!text.trim()) {
        return false;
    }

    const suspiciousControlChar = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
    return !suspiciousControlChar.test(text);
}

export function isZipContainer(buffer: Buffer): boolean {
    return startsWithBytes(buffer, ZIP_MAGIC);
}

export function isOleDocument(buffer: Buffer): boolean {
    return startsWithBytes(buffer, OLE_MAGIC);
}

export function isExcelWorkbook(buffer: Buffer): boolean {
    return isZipContainer(buffer) || isOleDocument(buffer);
}

export function isPdf(buffer: Buffer): boolean {
    return startsWithBytes(buffer, PDF_MAGIC);
}

export function isDocx(buffer: Buffer): boolean {
    return isZipContainer(buffer);
}

export function isPng(buffer: Buffer): boolean {
    return startsWithBytes(buffer, PNG_MAGIC);
}

export function isJpeg(buffer: Buffer): boolean {
    return startsWithBytes(buffer, JPEG_MAGIC);
}

export function isGif(buffer: Buffer): boolean {
    return buffer.length >= 6 && (buffer.subarray(0, 6).equals(GIF87A) || buffer.subarray(0, 6).equals(GIF89A));
}

export function isWebp(buffer: Buffer): boolean {
    return buffer.length >= 12 && buffer.subarray(0, 4).equals(RIFF) && buffer.subarray(8, 12).equals(WEBP);
}

export function isCsvLike(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, Math.min(buffer.length, 2048));
    const text = sample.toString('utf8').replace(/^\uFEFF/, '');

    if (!text.trim()) {
        return false;
    }

    if (!/[\n\r,;]/.test(text)) {
        return false;
    }

    const suspiciousControlChar = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
    return !suspiciousControlChar.test(text);
}

export function isJsonLike(buffer: Buffer): boolean {
    if (!isUtf8TextLike(buffer)) {
        return false;
    }

    try {
        JSON.parse(buffer.toString('utf8'));
        return true;
    } catch {
        return false;
    }
}

export function isSvgLike(buffer: Buffer): boolean {
    if (!isUtf8TextLike(buffer)) {
        return false;
    }

    const text = buffer.toString('utf8').slice(0, 4096).toLowerCase();
    return text.includes('<svg');
}

export function isPlainTextLike(buffer: Buffer): boolean {
    return isUtf8TextLike(buffer);
}

export function assertAnnouncementDocumentSignature(buffer: Buffer, mimetype: string): boolean {
    if (mimetype === 'application/pdf') {
        return isPdf(buffer);
    }

    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return isDocx(buffer);
    }

    return false;
}

export function assertImageSignature(buffer: Buffer, mimetype: string): boolean {
    switch (mimetype) {
        case 'image/jpeg':
            return isJpeg(buffer);
        case 'image/png':
            return isPng(buffer);
        case 'image/gif':
            return isGif(buffer);
        case 'image/webp':
            return isWebp(buffer);
        default:
            return false;
    }
}

export function assertSpreadsheetOrCsvSignature(buffer: Buffer, originalname: string, mimetype: string): boolean {
    const lowerName = originalname.toLowerCase();

    if (lowerName.endsWith('.csv') || mimetype.includes('csv')) {
        return isCsvLike(buffer);
    }

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || mimetype.includes('spreadsheet') || mimetype.includes('excel')) {
        return isExcelWorkbook(buffer);
    }

    return false;
}

export function assertAllowedUploadSignature(buffer: Buffer, originalname: string, mimetype: string): boolean {
    const lowerName = originalname.toLowerCase();

    if (mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
        return isPdf(buffer);
    }

    if (mimetype === 'application/msword' || lowerName.endsWith('.doc')) {
        return isOleDocument(buffer);
    }

    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lowerName.endsWith('.docx')) {
        return isDocx(buffer);
    }

    if (mimetype.startsWith('image/')) {
        return assertImageSignature(buffer, mimetype) || (mimetype === 'image/svg+xml' && isSvgLike(buffer));
    }

    if (
        lowerName.endsWith('.csv') ||
        lowerName.endsWith('.xls') ||
        lowerName.endsWith('.xlsx') ||
        mimetype.includes('csv') ||
        mimetype.includes('spreadsheet') ||
        mimetype.includes('excel')
    ) {
        return assertSpreadsheetOrCsvSignature(buffer, originalname, mimetype);
    }

    if (mimetype === 'application/json' || lowerName.endsWith('.json')) {
        return isJsonLike(buffer);
    }

    if (mimetype === 'text/plain' || lowerName.endsWith('.txt')) {
        return isPlainTextLike(buffer);
    }

    if (mimetype === 'application/zip' || lowerName.endsWith('.zip')) {
        return isZipContainer(buffer);
    }

    return false;
}
