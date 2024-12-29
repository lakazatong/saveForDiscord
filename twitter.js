'use strict';

(() => {

	// Injection logic

	function injectionLogic() {
		console.log('twitter');
		const startPersistantObserver = getStartPersistantObserver.bind(document);
		startPersistantObserver('HEADER', 'role', 'banner', softRemove);
		startPersistantObserver('DIV', 'data-testid', 'sidebarColumn', softRemove);
		startPersistantObserver('DIV', 'data-testid', 'DMDrawer', softRemove);
		startPersistantObserver('DIV', 'data-testid', 'primaryColumn', primaryColumn => {
			primaryColumn.style.border = '0px';
			const homeTimeline = primaryColumn.querySelector('div');
			softRemove(homeTimeline.querySelector('div:nth-child(1)'));
			const actualPrimaryColumn = homeTimeline.querySelector('div:nth-child(3) > div > div');
			actualPrimaryColumn.style.width = '100vw';
			actualPrimaryColumn.style.maxWidth = '100vw';
		});
	}

	// Script init

	if (!twitterScriptInit) {
		chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
			if (msg.request === 'twitterMedia') {
				// injectionLogic();
			}
		});
		injectionLogic();
		twitterScriptInit = true;
	}

})();