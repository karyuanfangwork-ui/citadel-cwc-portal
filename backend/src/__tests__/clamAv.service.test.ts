import { createServer } from 'net';
import { Readable } from 'stream';
import { config } from '../config';
import { parseClamAvResponse, scanStream } from '../services/clamAv.service';

describe('ClamAV response parser', () => {
    it('recognizes a clean INSTREAM response', () => {
        expect(parseClamAvResponse('stream: OK\0')).toEqual({ status: 'CLEAN' });
    });

    it('extracts the malware signature from an infected response', () => {
        expect(parseClamAvResponse('stream: Eicar-Signature FOUND\0')).toEqual({
            status: 'INFECTED',
            signature: 'Eicar-Signature',
        });
    });

    it('fails closed for scanner errors and malformed responses', () => {
        expect(() => parseClamAvResponse('stream: Size limit exceeded. ERROR\0'))
            .toThrow('ClamAV scan failed');
        expect(() => parseClamAvResponse('')).toThrow('empty response');
        expect(() => parseClamAvResponse('stream: NOT OK\0')).toThrow('ClamAV scan failed');
    });

    it('uses the ClamAV INSTREAM protocol against a real TCP endpoint', async () => {
        const payloads: Buffer[] = [];
        const server = createServer((socket) => {
            socket.on('data', (chunk) => {
                payloads.push(Buffer.from(chunk));
                if (Buffer.concat(payloads).includes(Buffer.alloc(4))) {
                    socket.end('stream: OK\0');
                }
            });
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Test scanner did not bind a TCP port');
        const previousHost = config.attachmentScanner.host;
        const previousPort = config.attachmentScanner.port;
        config.attachmentScanner.host = '127.0.0.1';
        config.attachmentScanner.port = address.port;

        try {
            await expect(scanStream(Readable.from(Buffer.from('sample')))).resolves.toEqual({ status: 'CLEAN' });
            expect(Buffer.concat(payloads).subarray(0, 10).toString()).toBe('zINSTREAM\0');
        } finally {
            config.attachmentScanner.host = previousHost;
            config.attachmentScanner.port = previousPort;
            await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        }
    });
});
