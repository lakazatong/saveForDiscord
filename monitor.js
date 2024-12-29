'use strict';

(() => {

const regexes = [
	{ name: 'pixivArtworks', regex: /^https:\/\/www\.pixiv\.net\/en\/artworks\/(\d+)$/ },
	{ name: 'twitterMedia', regex: /^https:\/\/x\.com\/\w+\/media$/ }
];
let lastUrl;
let updateTimeout;

function update() {
	const url = window.location.href;
	if (url === lastUrl) {
		return;
	}

	lastUrl = url;

	for (const { name, regex } of regexes) {
		if (regex.test(url)) {
			chrome.runtime.sendMessage({ request: name });
			return;
		}
	}
}

window.addEventListener('popstate', function (event) {
	if (updateTimeout) {
		clearTimeout(updateTimeout);
	}
	updateTimeout = setTimeout(() => {
		update();
	}, 100);
});

})();
