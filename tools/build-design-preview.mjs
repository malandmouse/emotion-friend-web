/** Build a self-contained, offline preview. Never start a server or access account/provider data. */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
if (!process.argv[2]) throw Error('출력 폴더를 인자로 지정해 주세요. 기존 서비스의 dist 폴더는 사용하지 않습니다.');
const output = path.resolve(process.argv[2]);
if (output === root || output.startsWith(path.join(root, 'src')) || output === path.join(root, 'dist')) throw Error('기존 소스/dist와 다른 출력 폴더를 사용해 주세요.');
const result = await build({ configFile: false, root, publicDir: false, plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: { write: false, minify: true, cssMinify: true, cssCodeSplit: false,
    lib: { entry: path.join(root, 'src/design-preview/main.tsx'), name: 'ExpressionFriendDesignPreview', formats: ['iife'], fileName: 'preview' } } });
const items = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
const javascript = items.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
let css = items.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source.toString()).join('\n');
for (const name of ['Regular', 'Medium', 'SemiBold', 'Bold']) {
  const filename = `Pretendard-${name}.otf`;
  const font = await readFile(path.join(root, 'public/fonts', filename));
  css = css.replaceAll(`/fonts/${filename}`, `data:font/otf;base64,${font.toString('base64')}`);
}
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>보호자 웹 디자인 미리보기 · 나의 표정 친구</title><style>${css.replaceAll('</style', '<\\/style')}</style></head><body><div id="root"></div><script>${javascript.replaceAll('</script', '<\\/script')}</script></body></html>`;
await mkdir(output, { recursive: true });
await writeFile(path.join(output, '보호자 웹 디자인 미리보기.html'), html);
console.log(`미리보기 저장: ${output} (예시 데이터/네트워크 차단/서버 변경0)`);
