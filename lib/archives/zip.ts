type ZipEntry = {
  name: string;
  data: Uint8Array | ReadableStream<Uint8Array>;
};

type CentralDirectoryEntry = {
  name: string;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
};

const textEncoder = new TextEncoder();
const crcTable = createCrcTable();

export async function createZipBuffer(entries: ZipEntry[]) {
  const chunks: Uint8Array[] = [];
  const stream = createZipStream(entries);
  const reader = stream.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return concat(chunks);
}

export function createZipStream(entries: Iterable<ZipEntry> | AsyncIterable<ZipEntry>) {
  const iterator = Symbol.asyncIterator in entries
    ? entries[Symbol.asyncIterator]()
    : (async function* () {
        yield* entries as Iterable<ZipEntry>;
      })();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const centralDirectory: CentralDirectoryEntry[] = [];
      let offset = 0;

      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        const entry = next.value;
        const name = normalizeZipName(entry.name);
        const nameBytes = textEncoder.encode(name);
        const localHeader = localFileHeader(nameBytes);
        controller.enqueue(localHeader);
        const entryOffset = offset;
        offset += localHeader.length;

        let crc32 = 0;
        let size = 0;
        const reader = toReadableStream(entry.data).getReader();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          crc32 = updateCrc32(crc32, value);
          size += value.length;
          offset += value.length;
          controller.enqueue(value);
        }

        const descriptor = dataDescriptor(crc32 >>> 0, size);
        controller.enqueue(descriptor);
        offset += descriptor.length;
        centralDirectory.push({
          name,
          crc32: crc32 >>> 0,
          compressedSize: size,
          uncompressedSize: size,
          offset: entryOffset,
        });
      }

      const directoryStart = offset;
      for (const entry of centralDirectory) {
        const header = centralDirectoryHeader(entry);
        controller.enqueue(header);
        offset += header.length;
      }

      controller.enqueue(endOfCentralDirectory(centralDirectory.length, offset - directoryStart, directoryStart));
      controller.close();
    },
  });
}

function localFileHeader(nameBytes: Uint8Array) {
  const output = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x08, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(26, nameBytes.length, true);
  output.set(nameBytes, 30);
  return output;
}

function dataDescriptor(crc32: number, size: number) {
  const output = new Uint8Array(16);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc32, true);
  view.setUint32(8, size, true);
  view.setUint32(12, size, true);
  return output;
}

function centralDirectoryHeader(entry: CentralDirectoryEntry) {
  const nameBytes = textEncoder.encode(entry.name);
  const output = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x08, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, entry.crc32, true);
  view.setUint32(20, entry.compressedSize, true);
  view.setUint32(24, entry.uncompressedSize, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, entry.offset, true);
  output.set(nameBytes, 46);
  return output;
}

function endOfCentralDirectory(entryCount: number, directorySize: number, directoryOffset: number) {
  const output = new Uint8Array(22);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, directorySize, true);
  view.setUint32(16, directoryOffset, true);
  return output;
}

function toReadableStream(data: Uint8Array | ReadableStream<Uint8Array>) {
  if (data instanceof ReadableStream) return data;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
}

function updateCrc32(previous: number, chunk: Uint8Array) {
  let crc = previous ^ 0xffffffff;
  for (const byte of chunk) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function normalizeZipName(name: string) {
  return name.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\./g, "");
}
