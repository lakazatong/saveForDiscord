'use strict';

// Add the right click context menu option

const contextMenuId = "saveForDiscord";

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: contextMenuId,
		title: "Save for Discord",
		contexts: ["image"]
	});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === contextMenuId && info.srcUrl) {
		chrome.tabs.sendMessage(tab.id, {
			request: 'saveForDiscord',
			url: info.srcUrl
		}).catch((error) => {
			console.log(`Could not send message: ${error}`);
		});
	}
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg.request === 'saveForDiscord') {
		downloadImage(msg.url, getFilenameFromUrl(msg.url), true);
	}
});

// Redirect /users to /users/illustrations

const pixivUsersRegex = /^https:\/\/www\.pixiv\.net\/en\/users\/(\d+)$/;

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	let match = pixivUsersRegex.exec(tab.url);
	if (match && changeInfo.status == "loading") {
		chrome.tabs.update(tabId, { url: `https://www.pixiv.net/en/users/${match[1]}/illustrations` });
		return;
	}
});

// Inject logic

let injectedTabs = new Set();

function inject(tabId, files) {
	chrome.scripting.executeScript({ target: { tabId }, files });
}

function injectCommonScripts(tabId) {
	inject(tabId, ['common.js', 'monitor.js']);
}

const content_scripts = [
	{
		regex: /^https:\/\/www\.pixiv\.net\//,
		onActivatedScript: 'pixiv.js'
	},
	{
		regex: /^https:\/\/x\.com\//,
		onActivatedScript: 'twitter.js'
	}
];

function handleTab(tab, onActivated = false) {
	const tabId = tab.id;
	if (injectedTabs.has(tabId)) { return; }
	const url = tab.url;
	for (const { regex, onActivatedScript } of content_scripts) {
		if (!regex.test(url)) { continue; }
		injectCommonScripts(tabId);
		injectedTabs.add(tabId);
		console.log(tab, `injected with common.js, monitor.js`);
		if (onActivated) {
			inject(tabId, [onActivatedScript]);
			console.log('Injected additional script for onActivated:', onActivatedScript);
		}
		break;
	}
}

chrome.tabs.onActivated.addListener(activeInfo => {
	chrome.tabs.get(activeInfo.tabId, function (tab) {
		handleTab(tab, true);
	});
});
chrome.tabs.onCreated.addListener(handleTab);
chrome.tabs.onRemoved.addListener(tabId => injectedTabs.delete(tabId));

function historyExactMatch(history, histories) {
	for (let index = 0; index < histories.length; index++) {
		const h = histories[index][0];
		if (history.length < h.length) {
			continue;
		}
		let match = true;
		for (let i = 0; i < h.length; i++) {
			const historyIndex = history.length - h.length + i;
			for (const key in h[i]) {
				const cur = history[historyIndex][key];
				if (cur === undefined || (h[i][key] !== null && h[i][key] !== cur)) {
					match = false;
					break;
				}
			}
			if (!match) {
				break;
			}
		}
		if (match) {
			console.log(`match between:\nHistory: ${JSON.stringify(history.slice(history.length - h.length))}\nPattern: ${JSON.stringify(h)}`);
			return index;
		}
	}
	return -1;
}

function historyLooseMatch(history) {
	let state = 0;
	for (const entry of history) {
		if (state === 0 && entry.status === 'loading' && entry.url) {
			state = 1; // Found the first "loading, url"
		} else if (state === 1 && entry.status === 'loading') {
			state = 2; // Found the second "loading"
		} else if (state >= 1 && entry.status === 'complete') {
			return true; // Found a "complete" after the relevant sequence
		}
	}
	return false;
}

// changeInfo histories in the mentioned orders
// a value of null means it can match anything, as long as the key is there
[
	['pixiv.js', /^https:\/\/www\.pixiv\.net\/en\/artworks\/(\d+)$/, [
		// new page
		[[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ title: null },
			{ status: 'loading' },
			{ status: 'complete' },
		]],
		// new page from refresh
		[[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'loading' },
			{ status: 'complete' },
		]],
		// refresh 1
		[[
			{ status: 'loading', url: null },
			{ status: 'complete' },
			{ favIconUrl: null },
			{ title: null },
		]],
		// refresh 2
		[[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ status: 'complete' },
		]],
		// from https://www.pixiv.net/en/*
		[[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'complete' },
		], false]
	]],
	['twitter.js', /^https:\/\/x\.com\/\w+/, [
		// new page 1
		[[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'loading' },
			{ status: 'complete' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
		]],
		// new page 2
		[[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'loading' },
			{ status: 'complete' },
			{ title: null },
			{ title: null },
			{ favIconUrl: null },
		]],
		// new page 3
		[[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'loading' },
			{ status: 'complete' },
			{ title: null },
			{ title: null },
			{ title: null },
			{ favIconUrl: null },
		]],
		// new page from refresh
		[[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'loading' },
			{ title: null },
			{ status: 'complete' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
		]],
		// refresh 1
		[[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ status: 'complete' },
			{ title: null },
			{ favIconUrl: null },
		]],
		// refresh 2
		[[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
			{ status: 'complete' },
			{ title: null },
			{ favIconUrl: null },
		]],
		// refresh 3
		[[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ status: 'complete' },
			{ favIconUrl: null },
			{ title: null },
		]],
		// refresh 4
		[[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
			{ status: 'complete' },
			{ favIconUrl: null },
			{ title: null },
		]],
		// refresh 5
		[[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ status: 'complete' },
			{ title: null },
			{ title: null },
			{ title: null },
		]],
		// refresh 6
		[[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
			{ status: 'complete' },
			{ title: null },
			{ title: null },
		]],
		// refresh 7
		[[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
			{ title: null },
			{ status: 'complete' },
			{ title: null },
		]],
		// refresh 8
		[[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
			{ title: null },
			{ title: null },
			{ status: 'complete' },
		]],
		// // from https://x.com/*
		// [[
		// 	{status: 'loading', url: null},
		// 	{status: 'complete'},
		// 	{favIconUrl: null},
		// 	{title: null},
		// ], false]
	]]
].forEach(([script, regex, histories]) => {
	let timer;
	const history = [];
	const minHistoryLength = Math.min(...histories.map(h => h[0].length));
	const maxHistoryLength = Math.max(...histories.map(h => h[0].length));
	histories.sort((a, b) => b[0].length - a[0].length);
	chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
		if (!regex.test(tab.url)) { return; }
		history.push(changeInfo);
		// console.log(changeInfo);
		if (history.length < minHistoryLength) { return; }
		while (history.length > maxHistoryLength) { history.shift(); }
		const index = historyExactMatch(history, histories);
		if (index >= 0) {
			if (histories[index].length === 1 || (histories[index].length === 2 && histories[index][1])) {
				injectCommonScripts(tabId);
				if (!injectedTabs.has(tabId)) {
					injectedTabs.add(tabId);
				}
			}
			inject(tabId, [script]);
		}
	})
});

// Relay monitor messages

function onMessageCallback(msg, sender, sendResponse) {
	if (msg.request === 'pixivArtworks' || msg.request === 'twitterPage') {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, msg);
			}
		});
	}
}
chrome.runtime.onMessage.addListener(onMessageCallback);
