const Url = require('url-parse');
const path = require('path');
// https://stackoverflow.com/a/19709846/308237
const absoluteUrlRX = new RegExp('^(?:[a-z]+:)?//', 'i');

const headersToArray = headers => {
	// node-fetch 1 Headers
	if (typeof headers.raw === 'function') {
		return Object.entries(headers.raw());
	} else if (headers[Symbol.iterator]) {
		return [...headers];
	} else {
		return Object.entries(headers);
	}
};

const zipObject = entries =>
	entries.reduce((obj, [key, val]) => Object.assign(obj, { [key]: val }), {});

const normalizeUrl = inUrl => {
	if (
		typeof inUrl === 'function' ||
		inUrl instanceof RegExp ||
		/^(begin|end|glob|express|path)\:/.test(inUrl)
	) {
		return inUrl;
	}

	const url = inUrl.toString();

	let res;

	const u = new Url(url);

	if (absoluteUrlRX.test(url)) {
		if (url.indexOf('..') > -1) {
			res = `${u.protocol}//${u.host}${path.join(u.pathname)}`;
		} else if (!u.query && (u.pathname === '/' || !u.pathname)) {
			res = `${u.origin}/`;
		} else {
			res = `${u.protocol}//${u.host}${path.join('/', u.pathname)}${u.query}`;
		}
	} else {
		if (url.indexOf('..') > -1 || url.indexOf('./') > -1) {
			res = `${u.host}${path.join('/', u.pathname)}${u.query}`;
		} else {
			res = u.pathname + u.query;
		}
	}

	return res;
};

module.exports = {
	normalizeRequest: (url, options, Request) => {
		if (Request.prototype.isPrototypeOf(url)) {
			const obj = {
				url: normalizeUrl(url.url),
				options: {
					method: url.method
				},
				request: url
			};

			const headers = headersToArray(url.headers);

			if (headers.length) {
				obj.options.headers = zipObject(headers);
			}
			return obj;
		} else if (
			typeof url === 'string' ||
			// horrible URL object duck-typing
			(typeof url === 'object' && 'href' in url)
		) {
			return {
				url: normalizeUrl(url),
				options: options
			};
		} else if (typeof url === 'object') {
			throw new TypeError(
				'fetch-mock: Unrecognised Request object. Read the Config and Installation sections of the docs'
			);
		} else {
			throw new TypeError('fetch-mock: Invalid arguments passed to fetch');
		}
	},
	normalizeUrl,
	getPath: url => {
		const u = absoluteUrlRX.test(url)
			? new Url(url)
			: new Url(url, 'http://dummy');

		return u.pathname;
	},

	getQuery: url => {
		const u = absoluteUrlRX.test(url)
			? new Url(url)
			: new Url(url, 'http://dummy');

		return u.query ? u.query.substr(1) : '';
	},
	headers: {
		normalize: headers => zipObject(headersToArray(headers)),
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
