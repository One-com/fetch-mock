const compileRoute = require('./compile-route');
const FetchMock = {};

const makeRouteComparator = (
	route,
	propName,
	comparator = null
) => candidateRoute => {
	if (route[propName] && candidateRoute[propName]) {
		return comparator && typeof comparator === 'function'
			? comparator(route[propName], candidateRoute[propName])
			: route[propName] === candidateRoute[propName];
	}

	return !route[propName] && !candidateRoute[propName];
};

const RouteMatcherSpec = {
	identifier: true,
	method: true,
	query: (routeQuery, candidateRouteQuery) => {
		const routeKeys = Object.keys(routeQuery);
		const candidateRouteKeys = Object.keys(candidateRouteQuery);

		if (routeKeys.length !== candidateRouteKeys.length) {
			return false;
		}

		if (routeKeys.some(k => candidateRouteKeys.indexOf(k) === -1)) {
			return false;
		}

		for (let i = 0; i < routeKeys.length; i++) {
			if (routeQuery[routeKeys[i]] !== candidateRouteQuery[routeKeys[i]]) {
				return false;
			}
		}

		return true;
	},
	repeat: true
};

const makeRoutMatcher = route => candidateRoute =>
	Object.keys(RouteMatcherSpec).reduce((acc, prop) => {
		if (!acc) return false;

		const compare = makeRouteComparator(route, prop, RouteMatcherSpec[prop]);
		return compare(candidateRoute);
	}, true);

FetchMock.mock = function(matcher, response, options = {}) {
	let route;

	// Handle the variety of parameters accepted by mock (see README)
	if (matcher && response) {
		route = Object.assign(
			{
				matcher,
				response
			},
			options
		);
	} else if (matcher && matcher.matcher) {
		route = matcher;
	} else {
		throw new Error('fetch-mock: Invalid parameters passed to fetch-mock');
	}

	this.addRoute(route);

	return this._mock();
};

FetchMock.addRoute = function(uncompiledRoute) {
	const addRoute = () => {
		this._uncompiledRoutes.push(uncompiledRoute);
		return this.routes.push(route);
	};

	const route = this.compileRoute(uncompiledRoute);
	const overwriteRoutes =
		'overwriteRoutes' in route
			? route.overwriteRoutes
			: this.config.overwriteRoutes;
	const matcher = makeRoutMatcher(route);
	const dupIndex = this.routes.findIndex(matcher);

	if (!overwriteRoutes) {
		if (dupIndex > -1) {
			throw new Error(
				// eslint-disable-next-line prettier/prettier
				`fetch-mock: Adding route ${route.identifier} with same name or matcher as existing route.
				See \`overwriteRoutes\` option.`
			);
		}
		return addRoute();
	}

	if (dupIndex > -1) {
		this._uncompiledRoutes.splice(dupIndex, 1, uncompiledRoute);
		return this.routes.splice(dupIndex, 1, route);
	}

	addRoute();
};

FetchMock._mock = function() {
	if (!this.isSandbox) {
		// Do this here rather than in the constructor to ensure it's scoped to the test
		this.realFetch = this.realFetch || this.global.fetch;
		this.global.fetch = this.fetchHandler;
	}
	return this;
};

FetchMock.catch = function(response) {
	if (this.fallbackResponse) {
		console.warn(
			'calling fetchMock.catch() twice - are you sure you want to overwrite the previous fallback response'
		); // eslint-disable-line
	}
	this.fallbackResponse = response || 'ok';
	return this._mock();
};

FetchMock.spy = function() {
	this._mock();
	return this.catch(this.getNativeFetch());
};

FetchMock.compileRoute = compileRoute;

FetchMock.once = function(matcher, response, options = {}) {
	return this.mock(
		matcher,
		response,
		Object.assign({}, options, { repeat: 1 })
	);
};

['get', 'post', 'put', 'delete', 'head', 'patch'].forEach(method => {
	const extendOptions = options =>
		Object.assign({}, options, { method: method.toUpperCase() });

	FetchMock[method] = function(matcher, response, options = {}) {
		return this.mock(matcher, response, extendOptions(options));
	};
	FetchMock[`${method}Once`] = function(matcher, response, options = {}) {
		return this.once(matcher, response, extendOptions(options));
	};
});

FetchMock.resetBehavior = function() {
	if (this.realFetch) {
		this.global.fetch = this.realFetch;
		this.realFetch = undefined;
	}
	this.fallbackResponse = undefined;
	this.routes = [];
	this._uncompiledRoutes = [];
	return this;
};

FetchMock.resetHistory = function() {
	this._calls = [];
	this._holdingPromises = [];
	this.routes.forEach(route => route.reset && route.reset());
	return this;
};

FetchMock.restore = FetchMock.reset = function() {
	this.resetBehavior();
	this.resetHistory();
	return this;
};

module.exports = FetchMock;
