import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractYouTubeVideoId,
  extractYouTubeVideosFromText,
  normalizeSafeHttpUrl,
  tokenizeRichText,
} from './richText.ts';

test('tokenizeRichText detects http, https, and www links inside Arabic sentences cleanly', () => {
  const tokens = tokenizeRichText(
    'شاهد هذا الموقع https://example.com/path?a=1، وكذلك www.google.com!'
  );
  const links = tokens.filter((t) => t.type === 'link');
  assert.equal(links.length, 2);
  assert.equal(links[0]!.href, 'https://example.com/path?a=1');
  assert.equal(links[0]!.displayHost, 'example.com');
  assert.equal(links[1]!.href, 'https://www.google.com/');
  assert.equal(links[1]!.displayHost, 'google.com');
});

test('normalizeSafeHttpUrl blocks unsafe protocols like javascript:', () => {
  assert.equal(normalizeSafeHttpUrl('javascript:alert(1)'), null);
  assert.equal(normalizeSafeHttpUrl('data:text/html,<h1>hi</h1>'), null);
  assert.equal(normalizeSafeHttpUrl('http://localhost'), null);
  assert.ok(normalizeSafeHttpUrl('https://tathkar.com/chat'));
});

test('extractYouTubeVideoId supports watch, youtu.be, shorts, mobile, and embed links', () => {
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s'),
    'dQw4w9WgXcQ'
  );
  assert.equal(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
});

test('extractYouTubeVideosFromText deduplicates repeated links', () => {
  const text = 'اسمعوا https://youtu.be/dQw4w9WgXcQ وايضاً https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const videos = extractYouTubeVideosFromText(text);
  assert.equal(videos.length, 1);
  assert.equal(videos[0]!.videoId, 'dQw4w9WgXcQ');
});
