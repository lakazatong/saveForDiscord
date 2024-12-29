'use strict';

(() => {

	// Injection logic

	function twitterMediaCallback() {
		console.log('twitter');
		const startAttributeObserver = getStartAttributeObserver.bind(document.body);
		startAttributeObserver('header', 'role', 'banner', softRemove);
		startAttributeObserver('div', 'data-testid', 'sidebarColumn', softRemove);
		startAttributeObserver('div', 'data-testid', 'DMDrawer', softRemove);
		startAttributeObserver('div', 'data-testid', 'primaryColumn', primaryColumn => {
			primaryColumn.style.border = '0px';
			const homeTimeline = primaryColumn.children[0];
			softRemove(homeTimeline.children[0]);
			// bruh
			setTimeout(() => {
				const actualPrimaryColumn = homeTimeline.children[2].children[0].children[0];
				actualPrimaryColumn.style.width = '100vw';
				actualPrimaryColumn.style.maxWidth = '100vw';
				softRemove(actualPrimaryColumn.children[0].children[0]);
				softRemove(actualPrimaryColumn.children[0].children[1].children[0]);
			}, 1000);
			// startNthChildObserver(primaryColumn, 1, 'div', homeTimeline => {
			// 	console.log(homeTimeline);
			// 	startNthChildObserver(homeTimeline, 1, 'div', softRemove);
			// 	startNthChildObserver(homeTimeline, 3, 'div', tmp => startNthChildObserver(tmp, 1, 'div', tmp => startNthChildObserver(tmp, 1, 'div', actualPrimaryColumn => {
			// 		console.log(actualPrimaryColumn);
			// 		actualPrimaryColumn.style.width = '100vw';
			// 		actualPrimaryColumn.style.maxWidth = '100vw';
			// 		// startSimpleObserver(actualPrimaryColumn, 'div > a', softRemove);
			// 		// startSimpleObserver(actualPrimaryColumn, 'div > div > div', softRemove);
			// 	})));
			// });
		});
	}

	// function twitterHighlightsCallback() {

	// }

	// Script init

	if (!twitterScriptInit) {
		chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
			if (msg.request === 'twitterMedia') {
				documentReady = getDocumentReady.bind(document);
				twitterMediaCallback();
			}
		});
		twitterScriptInit = true;
	}

	documentReady = getDocumentReady.bind(document);
	twitterMediaCallback();

})();