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

// const tabStates = new Map();

const contentScriptsConfig = [
	{
		regex: /^https:\/\/www\.pixiv\.net\/en\/artworks\/\d+/,
		callback: function (tab) { inject(tab.id, ['common.js', 'pixivArtworks.js']); },
	},
	{
		regex: /^https:\/\/x\.com\//,
		callback: function (tab) { inject(tab.id, ['common.js', 'twitter.js']); },
	}
];

function getFromDocument(tabId, key) {
	return new Promise(resolve => {
		chrome.scripting.executeScript({
			target: { tabId },
			func: key => {
				const keys = key.split('.');
				let value = document;
				for (let i = 0; i < keys.length; i++) {
					value = value[keys[i]];
					if (value === undefined) break;
				}
				return value;
			},
			args: [key]
		}, result => {
			resolve(result[0]?.result);
		});
	});
}

const tabsState = {};

// function handleTab(tab, onActivated) {
// 	const { id: tabId, url } = tab;
// 	let tabState = tabStates.get(tabId);
// 	if (tabState) return tabState;
// 	if (!url) return null;
// 	const config = contentScriptsConfig.find(({ regex }) => regex.test(url));
// 	if (!config) return null;
// 	tabState = { state: 0, ...config };
// 	tabStates.set(tabId, tabState);
// 	if (onActivated) config.callback(tab);
// 	return tabState;
// }

// function handleEvent(name, tab, onActivated = false) {
// 	const tabState = handleTab(tab, onActivated);
// 	if (tabState) {
// 		console.log(name, tab, tabState);
// 	}
// 	return tabState;
// }

// chrome.tabs.onCreated.addListener(tab => handleEvent('onCreated', tab));
// chrome.tabs.onActivated.addListener(({ tabId }) => chrome.tabs.get(tabId, tab => handleEvent('onActivated', tab, true)));
// chrome.tabs.onRemoved.addListener(tabId => tabStates.delete(tabId));
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	// const tabState = handleEvent('onUpdated', tab);
	// if (!tabState) return;
	// if (!tabState.regex.test(tab.url)) {
	// 	tabStates.delete(tabId);
	// 	return;
	// }
	// switch (tabState.state) {
	// 	case 0:
	// 		if (changeInfo.status === 'loading') {
	// 			tabState.state = 1;
	// 		}
	// 		break;
	// 	case 1:
	// 		const readyState = await getDocumentReadyState(tabId);
	// 		if (changeInfo.status === 'complete' || readyState === 'complete' || readyState === 'interactive') {
	// 			tabState.callback(tab);
	// 			tabState.state = 0;
	// 		}
	// 		break;
	// }
	const callback = contentScriptsConfig.find(({ regex }) => regex.test(tab.url))?.callback;
	if (!callback) return;
	
	const key = String(tabId);
	if (changeInfo.status === 'complete') {
		tabsState[key] = { state: 1 };
		return;
	}
	if (changeInfo.status === 'loading') {
		if (tabsState[key]?.state === 0) return;
		tabsState[key] = { state: 0 };
		let done = false;

		async function intervalCallback() {
			if (done) return;
			const readyState = await getFromDocument(tabId, 'readyState');
			if (readyState === 'interactive' || readyState === 'complete') {
				done = true;
				clearInterval(checkReadyState);
				if (tabsState[key]?.callbackTimeout) clearTimeout(tabsState[key].callbackTimeout);
				tabsState[key].callbackTimeout = setTimeout(() => callback(tab), 100);
			}
		}

		let p = Promise.resolve();
		const checkReadyState = setInterval(async () => {
			await p;
			if (done) return;
			p = intervalCallback();
		}, 100);
	}
});
