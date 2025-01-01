'use strict';

function inject(tabId, files) {
	const executeFile = (index) => {
		if (index >= files.length) return;
		console.log('injecting', files[index]);
		chrome.scripting.executeScript({
			target: { tabId },
			files: [files[index]]
		}, () => {
			executeFile(index + 1);
		});
	};
	executeFile(0);
}

const tabStates = new Map();

const contentScriptsConfig = [
	{
		regex: /^https:\/\/www\.pixiv\.net\/en\/artworks\/\d+/,
		callback: function (tab) { inject(tab.id, ['common.js', 'pixivArtworks.js']); },
	},
	{
		regex: /^https:\/\/x\.com\//,
		callback: function (tab) { console.log('Twitter Banner'); },
	}
];

function getDocumentReadyState(tabId) {
	return new Promise(resolve => {
		chrome.scripting.executeScript({
			target: { tabId },
			func: () => document.readyState
		}, ([result]) => resolve(result.result));
	});
}

function handleTab(tab, onActivated) {
	const { id: tabId, url } = tab;
	let tabState = tabStates.get(tabId);
	if (tabState) return tabState;
	if (!url) return null;
	const config = contentScriptsConfig.find(({ regex }) => regex.test(url));
	if (!config) return null;
	tabState = { state: 0, ...config };
	tabStates.set(tabId, tabState);
	if (onActivated) config.callback(tab);
	return tabState;
}

function handleEvent(name, tab, onActivated = false) {
	const tabState = handleTab(tab, onActivated);
	if (tabState) {
		console.log(name, tab, tabState);
	}
	return tabState;
}

chrome.tabs.onCreated.addListener(tab => handleEvent('onCreated', tab));
chrome.tabs.onActivated.addListener(({ tabId }) => chrome.tabs.get(tabId, tab => handleEvent('onActivated', tab, true)));
chrome.tabs.onRemoved.addListener(tabId => tabStates.delete(tabId));
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	const tabState = handleEvent('onUpdated', tab);
	if (!tabState) return;
	if (!tabState.regex.test(tab.url)) {
		tabStates.delete(tabId);
		return;
	}
	switch (tabState.state) {
		case 0:
			if (changeInfo.status === 'loading') {
				tabState.state = 1;
			}
			break;
		case 1:
			const readyState = await getDocumentReadyState(tabId);
			if (changeInfo.status === 'complete' || readyState === 'complete' || readyState === 'interactive') {
				tabState.callback(tab);
				tabState.state = 0;
			}
			break;
	}
});
