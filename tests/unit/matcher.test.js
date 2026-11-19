'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const matcher = require(path.join(__dirname, '..', '..', 'extension', 'content', 'matcher.js'));
// settings.js only attaches to globalThis; it never touches `browser` at load time.
require(path.join(__dirname, '..', '..', 'extension', 'content', 'settings.js'));
const { DEFAULTS, normalize, cleanList } = globalThis.SpoilerBlocker.settings;

// All text below is invented. "Zorblax Quest 9" is a fictional game.
const fictional = matcher.createMatcher({
  strongKeywords: ['Zorblax Quest 9', 'pizza', 'ZQ9'],
  weakKeywords: ['Zorblax', 'Quest', 'quest'], // duplicate on purpose
});

test('a strong keyword hides on its own, case-insensitively', () => {
  assert.equal(fictional.evaluate('Best PIZZA in town').hide, true);
  assert.equal(fictional.evaluate('zorblax quest 9 trailer reaction').hide, true);
});

test('matching is whole-word: keyword inside a longer word does not count', () => {
  assert.equal(fictional.evaluate('pizzazz and sparkle').hide, false);
  assert.equal(fictional.evaluate('ZQ9000 printer review').hide, false);
  assert.equal(fictional.evaluate('ZQ9 review').hide, true);
});

test('punctuation and hashtags still form word boundaries', () => {
  assert.equal(fictional.evaluate('#pizza night').hide, true);
  assert.equal(fictional.evaluate('(pizza)').hide, true);
  assert.equal(fictional.evaluate('pizza-making tips').hide, true);
  assert.equal(fictional.evaluate("pizza's history").hide, true);
});

test('multi-word keywords match as a phrase with flexible whitespace', () => {
  assert.equal(fictional.evaluate('Zorblax   Quest  9 is out').hide, true);
  assert.equal(fictional.evaluate('ZorblaxQuest9 is out').hide, true);
  assert.equal(fictional.evaluate('Zorblax quest nine').hide, true, 'two weak words still hide');
  const m = matcher.createMatcher({ strongKeywords: ['Zorblax Quest 9'], weakKeywords: [] });
  assert.equal(m.evaluate('Zorblax 9 Quest').hide, false, 'words out of order are not the phrase');
});

test('weak keywords only hide when two different ones match', () => {
  const m = matcher.createMatcher({ strongKeywords: [], weakKeywords: ['Zorblax', 'Quest'] });
  assert.equal(m.evaluate('Zorblax lore explained').hide, false);
  assert.equal(m.evaluate('Zorblax zorblax ZORBLAX').hide, false, 'same keyword repeated counts once');
  assert.equal(m.evaluate('Zorblax community quest update').hide, true);
});

test('duplicate keywords are collapsed so they cannot count twice', () => {
  assert.equal(fictional.weakCount, 2);
  const m = matcher.createMatcher({ strongKeywords: [], weakKeywords: ['Quest', 'quest', ' QUEST '] });
  assert.equal(m.weakCount, 1);
  assert.equal(m.evaluate('quest log').hide, false);
});

test('evaluate reports which keywords matched', () => {
  const verdict = fictional.evaluate('Zorblax quest pizza');
  assert.deepEqual(verdict.strong, ['pizza']);
  assert.deepEqual(verdict.weak, ['Zorblax', 'Quest']);
  assert.equal(verdict.hide, true);
});

test('text is NFKC-normalised and zero-width characters are stripped', () => {
  assert.equal(fictional.evaluate('ｐｉｚｚａ time').hide, true, 'fullwidth letters');
  assert.equal(fictional.evaluate('pi​zz‌a time').hide, true, 'zero-width characters');
  assert.equal(fictional.evaluate('pi­zza time').hide, true, 'soft hyphen');
});

test('empty, null and non-string input never hide', () => {
  assert.equal(fictional.evaluate('').hide, false);
  assert.equal(fictional.evaluate(null).hide, false);
  assert.equal(fictional.evaluate(undefined).hide, false);
  assert.equal(fictional.evaluate(42).hide, false);
});

test('keywords containing regex characters are treated literally', () => {
  const m = matcher.createMatcher({ strongKeywords: ['c++ (advanced)', 'a.b'], weakKeywords: [] });
  assert.equal(m.evaluate('learning c++ (advanced) today').hide, true);
  assert.equal(m.evaluate('a.b notation').hide, true);
  assert.equal(m.evaluate('axb notation').hide, false);
});

test('empty and whitespace keywords are ignored', () => {
  const m = matcher.createMatcher({ strongKeywords: ['', '   ', null], weakKeywords: [undefined] });
  assert.equal(m.strongCount, 0);
  assert.equal(m.weakCount, 0);
  assert.equal(m.evaluate('anything at all').hide, false);
});

test('channel blocklist matches handles in paths and display names', () => {
  const blocked = ['@ZorblaxCentral', 'Pizza Reviews Daily'];
  assert.equal(matcher.channelBlocked(['/@zorblaxcentral/videos'], blocked), true);
  assert.equal(matcher.channelBlocked(['/@ZorblaxCentral?feature=x'], blocked), true);
  assert.equal(matcher.channelBlocked(['Pizza Reviews Daily'], blocked), true);
  assert.equal(matcher.channelBlocked(['@pizza reviews daily'], blocked), true);
  assert.equal(matcher.channelBlocked(['/c/zorblaxcentral'], blocked), true);
  assert.equal(matcher.channelBlocked(['/@zorblaxcentral2'], blocked), false);
  assert.equal(matcher.channelBlocked(['/@someoneelse', 'Other Channel'], blocked), false);
  assert.equal(matcher.channelBlocked(['/@zorblaxcentral'], []), false);
  assert.equal(matcher.channelBlocked([], blocked), false);
});

test('default strong keywords each match themselves and nothing hides on one default weak keyword', () => {
  const m = matcher.createMatcher(DEFAULTS);
  for (const keyword of DEFAULTS.strongKeywords) {
    assert.equal(m.evaluate(keyword).hide, true, keyword);
    assert.equal(m.evaluate(keyword.toLowerCase()).hide, true, keyword.toLowerCase());
  }
  for (const keyword of DEFAULTS.weakKeywords) {
    assert.equal(m.evaluate(keyword).hide, false, keyword);
  }
  assert.equal(m.evaluate('Baking sourdough at home').hide, false);
});

test('settings.normalize merges stored values over defaults', () => {
  const merged = normalize({ enabled: false, weakKeywords: ['one', 'one', ' '] });
  assert.equal(merged.enabled, false);
  assert.deepEqual(merged.strongKeywords, [...DEFAULTS.strongKeywords]);
  assert.deepEqual(merged.weakKeywords, ['one']);
  assert.deepEqual(merged.blockedChannels, []);
  assert.equal(merged.blurThumbnails, false);
  assert.equal(merged.strictMode, false);
  assert.deepEqual(normalize(undefined), normalize({}));
  assert.deepEqual(cleanList(['A', 'a', '', 'B ']), ['A', 'B']);
});
