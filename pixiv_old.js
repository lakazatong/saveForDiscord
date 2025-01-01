'use strict';

(() => {

	// Add SaveForDiscord buttons

	function buttonsMouseOver(b) {
		return () => {
			b.style.opacity = '0.9';
			setFilter(b.style.filter, 'saturate', '0.87');
			b.style.textShadow = `0 0 10px var(--charcoal-brand), 0 0 20px var(--charcoal-brand)`;
		};
	};

	function buttonsMouseOut(b) {
		return () => {
			b.style.opacity = '0.5';
			setFilter(b.style.filter, 'saturate', '1');
			b.style.textShadow = `0 0 5px var(--charcoal-brand), 0 0 10px var(--charcoal-brand)`;
		};
	};

	function createButtonStyles(index, text) {
		const button = document.createElement('button');
		const span = document.createElement('span');

		span.textContent = text;
		button.appendChild(span);

		Object.assign(button.style, {
			position: 'absolute',
			top: '0',
			left: `${(index / 11) * 100}%`,
			width: `${100 / 11}%`,
			height: '100%',
			color: 'var(--charcoal-text5)',
			border: 'none',
			borderRadius: '0',
			padding: '0',
			margin: '0',
			cursor: 'pointer',
			transition: 'color 0.2s, box-shadow 0.2s, opacity 0.2s, text-shadow 0.2s',
			textAlign: 'center',
			textShadow: `0 0 5px var(--charcoal-brand), 0 0 10px var(--charcoal-brand)`,
			filter: 'saturate(1)',
		});

		Object.assign(span.style, {
			fontSize: '14px',
			fontWeight: 'bold',
			margin: '0',
			padding: '0',
			whiteSpace: 'pre-wrap',
		});

		return button;
	}

	function addButtons(divs) {
		enabledButtons.length = 0;
		while (buttons.length) {
			while (buttons[0].length) {
				buttons[0].pop()?.remove();
			}
			buttons.shift();
		}
		if (!divs) {
			divs = document.body.querySelectorAll('div[role="presentation"]');
		}
		for (let i = 1; i < divs.length; i++) {
			enabledButtons.push(null);
			buttons.push([]);
			if (!(divs[i] instanceof HTMLDivElement)) {
				continue;
			}
			let buttonsVisible = false;
			let anchor = divs[i].querySelector('a');

			for (let j = 0; j < 11; j++) {
				const button = createButtonStyles(j, buttonsText[j]);
				button.userData = {};
				button.userData.channelAlias = buttonsText[j].toLowerCase().replace('\n', '_');
				if (j === 0) {
					Object.assign(button.style, {
						background: 'linear-gradient(to right, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%)',
						opacity: '0.5',
						pointerEvents: 'auto',
					});

					button.addEventListener('mouseover', buttonsMouseOver(button));
					button.addEventListener('mouseout', buttonsMouseOut(button));

					button.addEventListener('click', () => {
						buttonsVisible = !buttonsVisible;
						buttons[i - 1].slice(1).forEach(b => {
							Object.assign(b.style, {
								opacity: buttonsVisible ? '0.5' : '0',
								pointerEvents: buttonsVisible ? 'auto' : 'none',
							});
							b.addEventListener('mouseover', buttonsVisible ? buttonsMouseOver(b) : () => { });
							b.addEventListener('mouseout', buttonsVisible ? buttonsMouseOut(b) : () => { });
						});
					});
				} else {
					button.userData.enabled = false;

					Object.assign(button.style, {
						background: 'linear-gradient(to top, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 1) 50%, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0) 100%)',
						opacity: '0',
						pointerEvents: 'none',
					});

					button.addEventListener('mouseover', () => { });
					button.addEventListener('mouseout', () => { });

					button.addEventListener('click', () => {
						if (button.userData.enabled) {
							button.userData.enabled = false;
							button.style.filter = setFilter(button.style.filter, 'hue-rotate', '0deg');
							enabledButtons[i - 1] = null;
						} else {
							buttons[i - 1].slice(1).forEach(b => {
								b.userData.enabled = false;
								b.style.filter = setFilter(b.style.filter, 'hue-rotate', '0deg');
							});
							button.userData.enabled = true;
							button.style.filter = setFilter(button.style.filter, 'hue-rotate', '90deg');
							enabledButtons[i - 1] = button;
							enabledButtons[i - 1].userData.imgUrl = anchor.href;
							addStickyButton();
						}
					});
				}
				divs[i].appendChild(button);
				buttons[i - 1].push(button);
			}
		}
	}

	function startPresentationDivsObserver(threshold) {
		new MutationObserver((mutationsList, observer) => {
			const divs = document.body.querySelectorAll('div[role="presentation"]');
			if (divs.length >= threshold) {
				observer.disconnect();
				addButtons(divs);
			}
		})
			.observe(document.body, { childList: true, subtree: true });
	}

	// Clicks on the Show all button as soon as it's found

	function startShowAllObserver() {
		removeStickyButton();
		const check = e => e?.tagName === 'BUTTON' && e?.querySelector('div:nth-child(2)')?.textContent.trim() === "Show all";
		getStartObserver(document.body)(
			() => [...document.body.querySelectorAll('button')].find(check),
			check,
			e => {
				e.click();
				startPresentationDivsObserver(3);
			}
		);
	}

	// Trigger save logic

	async function sendImages() {
		let pendingRequests = enabledButtons.filter(b => b).length;

		if (pendingRequests === 0) {
			return;
		}

		disableButton(stickyButton);

		const groupedByChannelAlias = enabledButtons.reduce((groups, enabledButton) => {
			if (!enabledButton) return groups;

			const { channelAlias, imgUrl } = enabledButton.userData;
			if (!groups[channelAlias]) {
				groups[channelAlias] = [];
			}
			groups[channelAlias].push(imgUrl);
			return groups;
		}, {});

		const promises = [];
		let curRequestPromise = Promise.resolve();

		Object.entries(groupedByChannelAlias).forEach(([channelAlias, imgUrls]) => {
			promises.push(
				Promise.all(
					imgUrls.map(async (url) => {
						const filename = getFilenameFromUrl(url);
						await downloadImage(url, filename, false);
						// return `C:\\Users\\Bo_wo\\Downloads\\${filename}`;
						return filename;
					})
				)
					.then(async (imgPaths) => {
						await curRequestPromise;
						const message = `[sauce](<${window.location.href}>)`;
						curRequestPromise = sendPutImgsRequest(channelAlias, imgPaths.join(','), message) || Promise.resolve();
						return curRequestPromise;
					})
			)
		});

		await Promise.all(promises);

		enableButton(stickyButton);
	}

	async function sendPutImgsRequest(channelAlias, imgPaths, message) {
		const url = new URL('http://localhost:3000/api/private/put_imgs');
		url.search = new URLSearchParams({ channelAlias, imgPaths, message }).toString();
		// console.log('GET', url);
		try {
			const response = await fetch(url, { method: 'GET' });
			return response.ok ? await response.text() : null;
		} catch (err) {
			return null;
		}
	}

	function disableButton(button) {
		button.disabled = true;
		button.style.opacity = '0.6';
		button.style.cursor = 'not-allowed';
	}

	function enableButton(button) {
		button.disabled = false;
		button.style.opacity = '1';
		button.style.cursor = 'pointer';
		button.style.backgroundColor = 'var(--charcoal-brand)';
	}

	function removeStickyButton() {
		if (stickyButton) {
			document.body.removeChild(stickyButton);
			stickyButton = null;
		}
	}

	function addStickyButton() {
		removeStickyButton();

		stickyButton = document.createElement('button');
		const span = document.createElement('span');

		span.textContent = "Send to Discord";
		stickyButton.appendChild(span);

		Object.assign(stickyButton.style, {
			position: 'fixed',
			bottom: '20px',
			left: '20px',
			backgroundColor: 'var(--charcoal-brand)',
			color: 'white',
			border: 'none',
			padding: '10px 20px',
			borderRadius: '5px',
			fontSize: '16px',
			cursor: 'pointer',
			boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
			transition: 'background-color 0.3s ease, opacity 0.3s ease',
		});

		stickyButton.addEventListener('mouseover', () => {
			if (!stickyButton.disabled) {
				stickyButton.style.backgroundColor = 'var(--charcoal-brand-hover)';
			}
		});

		stickyButton.addEventListener('mouseout', () => {
			if (!stickyButton.disabled) {
				stickyButton.style.backgroundColor = 'var(--charcoal-brand)';
			}
		});

		stickyButton.addEventListener('click', () => {
			if (!stickyButton.disabled) {
				sendImages();
			}
		});

		document.body.appendChild(stickyButton);
	}

	// Injection logic

	function pixivArtworksCallback() {
		console.log('pixivArtworks');
		startPresentationDivsObserver(2);
		startShowAllObserver();
	}

	// Script init

	if (!pixivScriptInit) {
		chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
			if (msg.request === 'pixivArtworks') {
				documentReady = getDocumentReady.bind(document);
				pixivArtworksCallback();
			}
		});
		pixivScriptInit = true;
	}

	documentReady = getDocumentReady.bind(document);
	pixivArtworksCallback();

})();