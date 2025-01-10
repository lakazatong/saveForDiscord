'use strict';

(() => {

	const states = [
		{
			name: 'pixivArtworks',
			regex: /^https:\/\/www\.pixiv\.net\/en\/artworks\/(\d+)$/,
			blacklist: []
		},
		{
			name: 'twitterPage',
			regex: /^https:\/\/x\.com\//,
			blacklist: [/^https:\/\/x\.com\//]
		}
	];

	let lastUrl;

	function update() {
		const url = window.location.href;
		if (url === lastUrl) {
			return;
		}

		if (lastUrl) {
			for (const { name, regex, blacklist } of states) {
				if (regex.test(url)) {
					if (blacklist.some(blacklistRegex => blacklistRegex.test(lastUrl))) {
						continue;
					}
					chrome.runtime?.sendMessage({ request: name });
					break;
				}
			}
		}

		lastUrl = url;
	}

	window.addEventListener('popstate', debounce(update, 100));

})();
