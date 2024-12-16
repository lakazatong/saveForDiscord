'use strict';

(() => {

const artworksRegex = /^https:\/\/www\.pixiv\.net\/en\/artworks\/(\d+)$/;
let lastUrl;
let updateTimeout;

function update() {
	const url = window.location.href;
	if (url === lastUrl) {
		return;
	}
	
	lastUrl = url;
	
	if (!artworksRegex.test(url)) {
		return;
	}
	
	console.log('startShowAllObserver sent');
	chrome.runtime.sendMessage({ request: 'startShowAllObserver' });
}

window.addEventListener('popstate', function (event) {
	console.log(event);
	if (updateTimeout) {
		clearTimeout(updateTimeout);
	}
	updateTimeout = setTimeout(() => {
		update();
	}, 100);
});

})();
