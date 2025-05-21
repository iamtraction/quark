import type { ReadableStream } from "node:stream/web";

export const toString = async (stream: ReadableStream, encoding: BufferEncoding = "utf8"): Promise<string> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        // if the chunk is a string, convert it to a Buffer using the specified encoding.
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk, encoding) : chunk);
    }
    return Buffer.concat(chunks).toString(encoding);
};
