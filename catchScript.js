'use strict';

(function () {
	const originalOpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function(method, url) {
		if (url.startsWith('https://x.com/i/api/graphql/mKl_8lL-ZQO2z-tHVnsetQ/UserMedia')) {
			this.addEventListener('load', function() {
				// console.log('received UserMedia response', JSON.parse(this.responseText));
				window.postMessage({
					action: 'UserMediaResponse',
					body: this.responseText,
				}, '*');
				// userMediaResponses.push(JSON.parse(this.responseText));
			});
		};
		originalOpen.apply(this, arguments);
	}
})();