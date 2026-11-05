import { test, expect } from './fixtures';

const files: [string, string][] = ['tap-1', 'tap-2', 'tap-3', 'tick'].flatMap(
  (n) => [
    [`${n}.ogg`, 'audio/ogg'],
    [`${n}.mp3`, 'audio/mpeg'],
  ],
);

test('sound files are served with audio content types, 20 KB total @D-04', async ({
  request,
}) => {
  let total = 0;
  for (const [file, type] of files) {
    const res = await request.get(`/sounds/${file}`);
    expect(res.status(), file).toBe(200);
    expect(res.headers()['content-type'], file).toContain(type);
    total += (await res.body()).length;
  }
  expect(total).toBeLessThanOrEqual(20 * 1024);
});
