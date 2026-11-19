import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAcceptLanguageCountry,
  extractHeaderCountry,
  isPrivateOrLoopbackIp,
  normalizeCountryCode,
  normalizeIpAddress,
  parseGeoApiCountry,
} from './geoip.ts';

test('normalizeIpAddress strips IPv4-mapped IPv6, ports, and x-forwarded-for chains', () => {
  assert.equal(normalizeIpAddress('::ffff:37.236.12.4'), '37.236.12.4');
  assert.equal(normalizeIpAddress('185.20.14.9, 10.0.0.1'), '185.20.14.9');
  assert.equal(normalizeIpAddress('51.39.20.10:54321'), '51.39.20.10');
  assert.equal(normalizeIpAddress('[::1]:3000'), '::1');
  assert.equal(normalizeIpAddress(''), '127.0.0.1');
});

test('isPrivateOrLoopbackIp accurately classifies local vs public IPs', () => {
  assert.equal(isPrivateOrLoopbackIp('127.0.0.1'), true);
  assert.equal(isPrivateOrLoopbackIp('::1'), true);
  assert.equal(isPrivateOrLoopbackIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrLoopbackIp('10.24.1.9'), true);
  assert.equal(isPrivateOrLoopbackIp('192.168.1.50'), true);
  assert.equal(isPrivateOrLoopbackIp('172.16.0.1'), true);
  assert.equal(isPrivateOrLoopbackIp('172.31.255.254'), true);
  assert.equal(isPrivateOrLoopbackIp('172.32.0.1'), false);
  assert.equal(isPrivateOrLoopbackIp('51.39.20.10'), false);
  assert.equal(isPrivateOrLoopbackIp('37.236.12.4'), false);
});

test('extractHeaderCountry reads CDN/proxy headers and ignores unknown placeholders', () => {
  assert.equal(extractHeaderCountry({ 'cf-ipcountry': 'iq' }), 'IQ');
  assert.equal(extractHeaderCountry({ 'x-appengine-country': 'AE' }), 'AE');
  assert.equal(extractHeaderCountry({ 'cf-ipcountry': 'XX', 'x-geo-country': 'KW' }), 'KW');
  assert.equal(extractHeaderCountry({ 'cf-ipcountry': 'T1' }), null);
  assert.equal(extractHeaderCountry({}), null);
});

test('extractAcceptLanguageCountry parses regional locale fallback cleanly', () => {
  assert.equal(extractAcceptLanguageCountry('ar-IQ,ar;q=0.9,en-US;q=0.8'), 'IQ');
  assert.equal(extractAcceptLanguageCountry('en-GB,en;q=0.9'), 'GB');
  assert.equal(extractAcceptLanguageCountry('ar'), null);
});

test('parseGeoApiCountry supports ipwho.is, ip-api.com, and rejects failures', () => {
  assert.equal(parseGeoApiCountry({ success: true, country_code: 'eg' }), 'EG');
  assert.equal(parseGeoApiCountry({ success: false, country_code: 'EG' }), null);
  assert.equal(parseGeoApiCountry({ status: 'success', countryCode: 'JO' }), 'JO');
  assert.equal(parseGeoApiCountry({ status: 'fail', countryCode: 'JO' }), null);
  assert.equal(normalizeCountryCode('sa'), 'SA');
  assert.equal(normalizeCountryCode('ZZ'), null);
});
