'use strict';

(() => {

// Inject CSS for the left header

function injectLeftHeaderCSS() {
	console.log('injectLeftHeaderCSS done');
}

// Injection logic

function injectionLogic() {
	injectLeftHeaderCSS();
}

// Script init

if (!twitterScriptInit) {
	chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
		if (msg.request === 'twitterMedia') {
			injectionLogic();
		}
	});
	twitterScriptInit = true;
}

injectionLogic();

})();