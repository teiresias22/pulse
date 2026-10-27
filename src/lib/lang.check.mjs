import { test } from 'node:test';
import assert from 'node:assert/strict';

// i18n.ts는 최상위에서 location·navigator를 읽는다 — node에서 import하기 전에 채운다
globalThis.location ??= { search: '' };
const { pickLang } = await import('../i18n.ts');

test('?lang 우선, 지원하지 않는 값은 무시', () => {
  assert.equal(pickLang('?lang=ja', 'ko-KR'), 'ja');
  assert.equal(pickLang('?lang=fr', 'es-419'), 'es');
});

test('기기 언어 앞 두 글자, 그 외는 영어', () => {
  assert.equal(pickLang('', 'ja-JP'), 'ja');
  assert.equal(pickLang('', 'KO'), 'ko');
  assert.equal(pickLang('', 'fr-FR'), 'en');
});
