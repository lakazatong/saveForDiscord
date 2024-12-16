'use strict';

// consts

const artworksRegex = /^https:\/\/www\.pixiv\.net\/en\/artworks\/(\d+)$/;
const usersRegex = /^https:\/\/www\.pixiv\.net\/en\/users\/(\d+)$/;
const contextMenuId = "saveForDiscord";

// add the right click context menu option

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

// redirect /users to /users/illustrations

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	let match = usersRegex.exec(tab.url);
	if (match && changeInfo.status == "loading") {
		chrome.tabs.update(tabId, {url: `https://www.pixiv.net/en/users/${match[1]}/illustrations`});
		return;
	}
});

// inject logic

function inject(tabId, files) {
	chrome.scripting.executeScript({ target: { tabId }, files });
}

// const pixivRegex = /^https:\/\/www\.pixiv\.net\//;

// handle already existing tabs (when the extension was first installed)
// function onActivatedCallback(activeInfo) {
// 	const tabId = activeInfo.tabId;
// 	chrome.tabs.get(tabId, (tab) => {
// 		if (tab.url && pixivRegex.test(tab.url) && !injectedTabs.has(tabId)) {
// 			inject(tabId, ['monitor.js', 'content.js']);
// 			injectedTabs.add(tabId);
// 		}
// 	});
// }
// chrome.tabs.onActivated.addListener(onActivatedCallback);

// changeInfo history in these cases in order:
// new page, refresh, from https://www.pixiv.net/en/*
// a value of null means it can match anything, as long as the key is there
const pixivHistories = [
	[
		{status: 'loading', url: null},
		{favIconUrl: null},
		{title: null},
		{status: 'loading'},
		{status: 'complete'}
	],
	[
		{status: 'loading', url: null},
		{status: 'complete'},
		{favIconUrl: null},
		{title: null}
	],
	[
		{status: 'loading', url: null},
		{favIconUrl: null},
		{status: 'complete'}
	]
];

const pixivHistory = [];
const minPixivHistoryLength = Math.min(...pixivHistories.map(h => h.length));
const maxPixivHistoryLength = Math.max(...pixivHistories.map(h => h.length));

function historyMatch(history, histories) {
	for (const h of histories) {
		if (history.length < h.length) {
			continue;
		}
		let match = true;
		for (let i = 0; i < h.length; i++) {
			const historyIndex = history.length - h.length + i;
			for (const key in h[i]) {
				if (h[i][key] !== null && h[i][key] !== history[historyIndex][key]) {
					match = false;
					break;
				}
			}
			if (!match) {
				break;
			}
		}
		if (match) {
			console.log('changeInfo history match found', history.slice(-h.length));
			return true;
		}
	}
	return false;
}

function onUpdatedPixivArtworks(tabId, changeInfo, tab) {
	const url = tab.url;
	if (!artworksRegex.test(url)) {
		return;
	}
	// console.log(changeInfo);
	pixivHistory.push(changeInfo);
	if (pixivHistory.length < minPixivHistoryLength) {
		return;
	}
	while (pixivHistory.length > maxPixivHistoryLength) {
		pixivHistory.shift();
	}
	if (historyMatch(pixivHistory, pixivHistories)) {
		inject(tabId, ['pixiv.js']);
	}
}
chrome.tabs.onUpdated.addListener(onUpdatedPixivArtworks);

// relay monitor messages

function onMessageCallback(msg, sender, sendResponse) {
	if (msg.request === 'startShowAllObserver') {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, msg);
			}
		});
	}
}
chrome.runtime.onMessage.addListener(onMessageCallback);
