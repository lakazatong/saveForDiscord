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

// Redirect /users to /users/illustrations

const pixivUsersRegex = /^https:\/\/www\.pixiv\.net\/en\/users\/(\d+)$/;

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	let match = pixivUsersRegex.exec(tab.url);
	if (match && changeInfo.status == "loading") {
		chrome.tabs.update(tabId, {url: `https://www.pixiv.net/en/users/${match[1]}/illustrations`});
		return;
	}
});

// Inject logic

function inject(tabId, files) {
	chrome.scripting.executeScript({ target: { tabId }, files });
}

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
			// console.log('changeInfo history match found', history.slice(-h.length));
			return true;
		}
	}
	return false;
}

// changeInfo history in these cases in order:
// new page, refresh, from https://www.pixiv.net/en/*
// a value of null means it can match anything, as long as the key is there

[
	['pixiv.js', /^https:\/\/www\.pixiv\.net\/en\/artworks\/(\d+)$/, [
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
	]],
	['twitter.js', /^https:\/\/x\.com\/\w+\/media$/, [
		[

		],
		[

		],
		[

		]
	]]
].forEach(([script, regex, histories]) => {
	const history = [];
	const minHistoryLength = Math.min(...histories.map(h => h.length));
	const maxHistoryLength = Math.max(...histories.map(h => h.length));
	chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
		if (!regex.test(tab.url)) { return; }
		history.push(changeInfo);
		if (history.length < minHistoryLength) { return; }
		while (history.length > maxHistoryLength) { history.shift(); }
		if (historyMatch(history, histories)) { inject(tabId, [script]); }
	})	
});

// Relay monitor messages

function onMessageCallback(msg, sender, sendResponse) {
	if (msg.request === 'pixivArtworks' || msg.request === 'twitterMedia') {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, msg);
			}
		});
	}
}
chrome.runtime.onMessage.addListener(onMessageCallback);
