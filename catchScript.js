'use strict';

// in case the inputString is too large, regex engine might return early and return garbage
function reduceForRegex(inputString, targetString) {
	const sliceLength = 1000;
	let result = '';
	let startIndex = 0;
	while ((startIndex = inputString.indexOf(targetString, startIndex)) !== -1) {
		const start = Math.max(startIndex - sliceLength, 0);
		const end = Math.min(startIndex + targetString.length + sliceLength, inputString.length);
		result += inputString.slice(start, end);
		startIndex += targetString.length;
	}
	return result;
}

(async function () {
	const userMediaRegex = new RegExp('queryId:"(.+)",operationName:"UserMedia"', 'gm');

	for (const link of document.head.querySelectorAll(':scope > link')) {
		if (!(/^https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.\w+\.js$/.test(link.href))) continue;

		const code = userMediaRegex.exec(reduceForRegex(await (await fetch(link.href)).text(), 'UserMedia'))[1];

		const originalOpen = XMLHttpRequest.prototype.open;
		XMLHttpRequest.prototype.open = function (method, url) {
			// console.log('XMLHttpRequest', url);

			if (url.startsWith(`https://x.com/i/api/graphql/${code}/UserMedia`)) {
				this.addEventListener('load', function () {
					window.postMessage({
						action: 'UserMediaResponse',
						body: this.responseText,
					}, '*');
				});
			};

			originalOpen.apply(this, arguments);
		};

		break;
	}

	const originalFetch = window.fetch;
	window.fetch = async function (...args) {
		try {
			// console.log('fetch', args[0])

			const response = await originalFetch(...args);

			// if (args[0].startsWith(<url>) && response.status === 200) {
			// 	const clonedResponse = response.clone();
			// 	const body = await clonedResponse.text();
			// 	...
			// }

			return response;
		} catch (error) {
			// console.error('fetch(', ...args, '):', error);
		}
	};
})();