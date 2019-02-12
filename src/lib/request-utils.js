const Url = require('url-parse');
const path = require('path');
// https://stackoverflow.com/a/19709846/308237
const absoluteUrlRX = new RegExp('^(?:[a-z]+:)?//', 'i');

const toArray = headers => {
	// node-fetch 1 Headers
	if (typeof headers.raw === 'function') {
		return Object.entries(headers.raw());
	} else if (headers[Symbol.iterator]) {
		return [...headers];
	} else {
		return Object.entries(headers);
	}
};

const zip = entries =>
	entries.reduce((obj, [key, val]) => Object.assign(obj, { [key]: val }), {});

module.exports = {
	normalizeUrl: inUrl => {
		if (
			typeof inUrl === 'function' ||
			inUrl instanceof RegExp ||
			/^(begin|end|glob|express|path)\:/.test(inUrl)
		) {
			return inUrl;
		}

		const url = inUrl.toString();

		let res;

		if (absoluteUrlRX.test(url)) {
			const u = new Url(url);

			if (url.indexOf('..') > -1) {
				res = `${u.protocol}//${u.host}${path.join(u.pathname)}`;
			} else {
				if (!u.query && (u.pathname === '/' || !u.pathname)) {
					res = `${u.origin}/`;
				} else {
					res = `${u.protocol}//${u.host}${path.join('/', u.pathname)}${
						u.query
					}`;
				}
			}
		} else {
			const u = new Url(url);

			if (url.indexOf('..') > -1 || url.indexOf('./') > -1) {
				res = `${u.host}${path.join('/', u.pathname)}${u.query}`;
			} else {
				res = u.pathname + u.query;
			}
		}

		return res;
	},
	getPath: url => {
		const u = absoluteUrlRX.test(url)
			? new Url(url)
			: new Url(url, 'http://dummy');
		return u.pathname;
	},
	headers: {
		normalize: headers => zip(toArray(headers)),
		toArray,
		zip,
		toLowerCase: headers =>
			Object.keys(headers).reduce((obj, k) => {
				obj[k.toLowerCase()] = headers[k];
				return obj;
			}, {}),
		equal: (actualHeader, expectedHeader) => {
			actualHeader = Array.isArray(actualHeader)
				? actualHeader
				: [actualHeader];
			expectedHeader = Array.isArray(expectedHeader)
				? expectedHeader
				: [expectedHeader];

			if (actualHeader.length !== expectedHeader.length) {
				return false;
			}

			return actualHeader.every((val, i) => val === expectedHeader[i]);
		}
	}
};
