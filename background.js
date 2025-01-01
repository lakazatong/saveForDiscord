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

function inject(tabId, files) {
	chrome.scripting.executeScript({ target: { tabId }, files });
}

function historyExactMatch(history, histories) {
	for (let index = 0; index < histories.length; index++) {
		const h = histories[index];
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
		[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ title: null },
			{ status: 'loading' },
			{ status: 'complete' },
		],
		// new page from refresh
		[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'loading' },
			{ status: 'complete' },
		],
		// refresh 1
		[
			{ status: 'loading', url: null },
			{ status: 'complete' },
			{ favIconUrl: null },
			{ title: null },
		],
		// refresh 2
		[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ status: 'complete' },
		],
		// from https://www.pixiv.net/en/*
		[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'complete' },
		]
	]],
	['twitter.js', /^https:\/\/x\.com\/\w+/, [
		// new page 1
		[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'loading' },
			{ status: 'complete' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
		],
		// new page 2
		[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'loading' },
			{ status: 'complete' },
			{ title: null },
			{ title: null },
			{ favIconUrl: null },
		],
		// new page 3
		[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'loading' },
			{ status: 'complete' },
			{ title: null },
			{ title: null },
			{ title: null },
			{ favIconUrl: null },
		],
		// new page from refresh
		[
			{ status: 'loading', url: null },
			{ favIconUrl: null },
			{ status: 'loading' },
			{ title: null },
			{ status: 'complete' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
		],
		// refresh 1
		[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ status: 'complete' },
			{ title: null },
			{ favIconUrl: null },
		],
		// refresh 2
		[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
			{ status: 'complete' },
			{ title: null },
			{ favIconUrl: null },
		],
		// refresh 3
		[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ status: 'complete' },
			{ favIconUrl: null },
			{ title: null },
		],
		// refresh 4
		[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
			{ status: 'complete' },
			{ favIconUrl: null },
			{ title: null },
		],
		// refresh 5
		[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ status: 'complete' },
			{ title: null },
			{ title: null },
			{ title: null },
		],
		// refresh 6
		[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
			{ status: 'complete' },
			{ title: null },
			{ title: null },
		],
		// refresh 7
		[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
			{ title: null },
			{ status: 'complete' },
			{ title: null },
		],
		// refresh 8
		[
			{ status: 'loading' },
			{ favIconUrl: null },
			{ title: null },
			{ title: null },
			{ title: null },
			{ title: null },
			{ status: 'complete' },
		],
		// // from https://x.com/*
		// [
		// 	{status: 'loading', url: null},
		// 	{status: 'complete'},
		// 	{favIconUrl: null},
		// 	{title: null},
		// ]
	]]
].forEach(([script, regex, histories]) => {
	let timer;
	const history = [];
	const minHistoryLength = Math.min(...histories.map(h => h.length));
	const maxHistoryLength = Math.max(...histories.map(h => h.length));
	histories.sort((a, b) => b.length - a.length);
	chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
		if (!regex.test(tab.url)) { return; }
		history.push(changeInfo);
		console.log(changeInfo);
		if (history.length < minHistoryLength) { return; }
		while (history.length > maxHistoryLength) { history.shift(); }
		const index = historyExactMatch(history, histories);
		if (index >= 0) {
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
