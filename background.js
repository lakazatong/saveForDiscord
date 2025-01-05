'use strict';

// Injection logic

function inject(tabId, files) {
	function executeFile(index) {
		if (index >= files.length) return;
		console.log('injecting', files[index], 'into', tabId);
		chrome.scripting.executeScript({
			target: { tabId },
			files: [files[index]]
		}, () => {
			executeFile(index + 1);
		});
	}
	executeFile(0);
}

const contentScriptsConfig = [
	{
		regex: /^https:\/\/www\.pixiv\.net\/en\/artworks\/\d+/,
		callback: function (tab) { inject(tab.id, ['pixivArtworks.js', 'common.js']); },
	},
	{
		regex: /^https:\/\/x\.com\//,
		callback: function (tab) { inject(tab.id, ['twitter.js', 'common.js']); },
	},
];

function getFromDocument(tabId, key) {
	return new Promise((resolve, reject) => {
		try {
			chrome.scripting.executeScript({
				target: { tabId },
				func: key => {
					if (!document || typeof document.querySelector !== 'function') return null;
					const keys = key.split('.');
					let value = document;
					for (let i = 0; i < keys.length; i++) {
						value = value[keys[i]];
						if (value === undefined) return null;
					}
					return value;
				},
				args: [key]
			}, result => {
				resolve(chrome.runtime.lastError ? null : (result?.[0]?.result || null));
			});
		} catch (err) {
			resolve(null);
		}
	});
}

const tabsState = new Map();

function callbackOnceTabReady(tabId, tab, callback) {
	const key = String(tabId);
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

chrome.tabs.onActivated.addListener(({ tabId }) => chrome.tabs.get(tabId, tab => {
	const callback = contentScriptsConfig.find(({ regex }) => regex.test(tab.url))?.callback;
	if (!callback) return;

	const key = String(tabId);
	if (tabsState[key] && (tabsState?.state || tabsState[key]?.lastUrl === tab.url)) return;

	tabsState[key] = { lastUrl: tab.url };

	callbackOnceTabReady(tabId, tab, callback);
}));

chrome.tabs.onRemoved.addListener(tabId => tabsState.delete(tabId));

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	const callback = contentScriptsConfig.find(({ regex }) => regex.test(tab.url))?.callback;
	if (!callback) return;

	const key = String(tabId);
	
	if (!tabsState[key]) tabsState[key] = {};

	if (changeInfo.status === 'complete') {
		tabsState[key].state = 1;
		tabsState[key].lastUrl = tab.url;
		return;
	}

	if (changeInfo.status === 'loading') {
		if (tabsState[key]?.state === 0) return;
		tabsState[key].state = 0;
		if (callback) callbackOnceTabReady(tabId, tab, callback);
		return;
	}
});

// Redirections

const redirections = [
	{
		regex: /^https:\/\/www\.pixiv\.net\/en\/users\/(\d+)$/,
		getRedirectUrl: match => `https://www.pixiv.net/en/users/${match[1]}/illustrations`,
	},
	{
		regex: /^https:\/\/x\.com\/(\w+)\/?$/,
		getRedirectUrl: match => `https://x.com/${match[1]}/media`,
		blacklist: [/^https:\/\/x\.com\/home\/?/],
	},
];

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	let match;
	const redirection = redirections.find(({ regex, blacklist }) => {
		if (match = regex.exec(tab.url)) return !(blacklist && blacklist.some(blacklistRegex => blacklistRegex.test(tab.url)));
		return false;
	});

	if (!redirection) return;

	const newUrl = redirection.getRedirectUrl(match);
	if (tab?.url !== newUrl) {
		console.log(`redirecting ${tab?.url} to ${newUrl}`);
		chrome.tabs.update(tabId, { url: newUrl });
	}
});