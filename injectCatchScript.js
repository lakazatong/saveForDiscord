(function () {
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('catchScript.js');
	document.head.appendChild(script);
})();