import { Socket } from 'net';
import { Readable } from 'stream';
import { config } from '../config';

export type MalwareScanResult =
    | { status: 'CLEAN' }
    | { status: 'INFECTED'; signature: string };

const MAX_CLAMAV_RESPONSE_BYTES = 8 * 1024;

export function parseClamAvResponse(response: string): MalwareScanResult {
    const normalized = response.replace(/\0/g, '').trim();
    if (normalized === 'stream: OK') return { status: 'CLEAN' };

    const infected = normalized.match(/^.+:\s+(.+)\s+FOUND$/);
    if (infected) return { status: 'INFECTED', signature: infected[1] };

    throw new Error(`ClamAV scan failed: ${normalized || 'empty response'}`);
}

export function scanStream(stream: Readable): Promise<MalwareScanResult> {
    return new Promise((resolve, reject) => {
        const socket = new Socket();
        const responseChunks: Buffer[] = [];
        let settled = false;

        const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            stream.destroy();
            socket.destroy();
            if (error) reject(error);
        };

        const resolveResponse = () => {
            if (settled) return;
            try {
                const result = parseClamAvResponse(Buffer.concat(responseChunks).toString('utf8'));
                settled = true;
                stream.destroy();
                socket.destroy();
                resolve(result);
            } catch (error) {
                finish(error instanceof Error ? error : new Error(String(error)));
            }
        };

        socket.setTimeout(config.attachmentScanner.timeoutMs);
        socket.once('timeout', () => finish(new Error('ClamAV scan timed out')));
        socket.once('error', (error) => finish(error));
        socket.on('data', (chunk) => {
            const responseChunk = Buffer.from(chunk);
            const responseSize = responseChunks.reduce((total, item) => total + item.length, 0)
                + responseChunk.length;
            if (responseSize > MAX_CLAMAV_RESPONSE_BYTES) {
                finish(new Error('ClamAV response exceeded the allowed size'));
                return;
            }
            responseChunks.push(responseChunk);
            if (responseChunk.includes(0)) resolveResponse();
        });
        socket.once('close', () => {
            if (settled) return;
            resolveResponse();
        });

        socket.connect(config.attachmentScanner.port, config.attachmentScanner.host, () => {
            socket.write('zINSTREAM\0');
            stream.on('data', (chunk: Buffer | string) => {
                const payload = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                const size = Buffer.allocUnsafe(4);
                size.writeUInt32BE(payload.length, 0);
                const frame = Buffer.concat([size, payload]);
                if (!socket.write(frame)) {
                    stream.pause();
                    socket.once('drain', () => stream.resume());
                }
            });
            stream.once('error', (error) => finish(error));
            stream.once('end', () => socket.end(Buffer.alloc(4)));
        });
    });
}

export const clamAvService = { scanStream };
