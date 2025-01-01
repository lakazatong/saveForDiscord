'use strict';

(() => {

	// Injection logic

	function twitterMediaCallback() {
		console.log('twitter');
		observeElementChanges(document.body, body => {
			const startAttributeObserver = getStartAttributeObserver(body);
			startAttributeObserver('header', 'role', 'banner', softRemove);
			startAttributeObserver('div', 'data-testid', 'sidebarColumn', softRemove);
			startAttributeObserver('div', 'data-testid', 'DMDrawer', softRemove);
			startAttributeObserver('div', 'data-testid', 'primaryColumn', primaryColumn => {
				primaryColumn.style.border = '0px';
				observeNthChild(primaryColumn, 0, homeTimeline => {
					observeNthChild(homeTimeline, 0, softRemove);
					observeNthChild(homeTimeline, [2, 0, 0], actualPrimaryColumn => {
						actualPrimaryColumn.style.width = '100vw';
						actualPrimaryColumn.style.maxWidth = '100vw';
						// remove banner and pp
						observeNthChild(actualPrimaryColumn, [0, 0], softRemove);
						observeNthChild(actualPrimaryColumn, [0, 1, 0], softRemove);
					})
				});
			});
		});
	}

	// function twitterHighlightsCallback() {

	// }

	// Script init

	if (!twitterScriptInit) {
		chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
			if (msg.request === 'twitterMedia') {
				console.log('twitter.js: received twitterMedia');
				documentReady = getDocumentReady.bind(document);
				twitterMediaCallback();
			}
		});
		twitterScriptInit = true;
	}

	documentReady = getDocumentReady.bind(document);
	twitterMediaCallback();

})();