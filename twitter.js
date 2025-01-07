'use strict';

window.addEventListener('commonLoaded', () => {

	if (window?.twitterInit === true) return;

	const userMediaResponses = [];

	function stripUrlAndAppendFormat(url) {
		const urlObj = new URL(url);
		const baseUrl = urlObj.origin + urlObj.pathname;
		const format = urlObj.searchParams.get('format') || 'png';
		return `${baseUrl}.${format}`;
	}

	function extractTweetId(url) {
		const regex = /(?:https?:\/\/(?:www\.)?x\.com\/|\/)(?:\w+\/)?status\/(\d+)(?:\/|\b)/;
		const match = url.match(regex);
		return match ? match[1] : null;
	}

	async function getTweetImageSrcs(tweetId) {
		console.log(userMediaResponses);
		// console.log(`fetching`, `https://twitter.com/i/web/status/${tweetId}`);
		// const response = await fetch(`https://twitter.com/i/web/status/${tweetId}`, {
		// 	method: 'GET',
		// 	headers: {
		// 		'Accept': 'text/html',
		// 	}
		// });
		// return (new DOMParser().parseFromString(await response.text(), 'text/html')).querySelector('div[data-testid="tweetPhoto"]').map(img => stripUrlAndAppendFormat(img.querySelector('img').getAttribute('src')));
	}

	// Injection logic

	console.log('twitter');
	window.documentReady = getDocumentReady.bind(document);

	const imageSets = new Map();

	function init() {
		if (document.querySelector(`*[id="${window.uuid}"]`)) return;

		const marker = document.createElement('div');
		marker.id = window.uuid;
		document.body.appendChild(marker);

		window.addEventListener('message', function (event) {
			if (event.source == window && event.data && event.data.action == 'UserMediaResponse') {
				const body = JSON.parse(event.data.body);
				userMediaResponses.push(body);
				console.log(body);
				// if (body.status == 'ok') {
				// 	console.log('UserMediaResponse', body.data);
				// }
			}
		});

		observeElementChanges(document.body, body => {
			const startAttributeObserver = getStartAttributeObserver(body);
			// left side column
			startAttributeObserver('header', 'role', 'banner', softRemove);
			// right side column
			startAttributeObserver('div', 'data-testid', 'sidebarColumn', softRemove);
			// self explainatory
			startAttributeObserver('div', 'data-testid', 'DMDrawer', softRemove);
			startAttributeObserver('div', 'data-testid', 'primaryColumn', primaryColumn => {
				primaryColumn.style.border = '0px';
				observeNthChild(primaryColumn, 0, homeTimeline => {
					// sticky top back and follow button with tweeter profile's name and posts count
					observeNthChild(homeTimeline, 0, softRemove);
					observeNthChild(homeTimeline, [2, 0, 0], actualPrimaryColumn => {
						// remove the content of the media page
						if (document.location.href.endsWith('media')) {
							observeNthChild(actualPrimaryColumn, 2, softRemove);
							setupNavigationSystem(actualPrimaryColumn);
						}

						// modify timeline's tweets
						
						observeNthChild(actualPrimaryColumn, [2, 1, 0], timeLine => {
							timeLine.querySelectorAll('li[role="listitem"]').forEach(liElement => {
								startObserver(liElement, () => liElement.querySelector('img'), e => e.tagName === 'IMG', img => {
									const src = stripUrlAndAppendFormat(img.getAttribute('src'));
									if (imageSets.has(src)) return;
									startObserver(liElement, () => liElement.querySelector('a[role="link"]'), e => e.tagName === 'A' && e.getAttribute('role') === 'link', async link => {
										imageSets.set(src, link.querySelector('svg') ? getTweetImageSrcs(extractTweetId(link.getAttribute('href'))) : [src]);
									});
								});
							});

							function modifyTweet() {
								// console.log('modifyTweet called');
								getStartAttributeObserver(timeLine)('article', 'data-testid', 'tweet', tweet => {
									observeNthChild(tweet, [0, 0, 1], tweetTopDiv => {
										// delete tweets with no img
										observeNthChild(tweetTopDiv, 1, tweetDiv => {
											if (tweetDiv.children.length === 3) {
												let parent = tweet;
												while (parent) {
													if (parent.getAttribute('data-testid') === 'cellInnerDiv') {
														// console.log(`deleted tweet:`, parent);
														softRemove(parent);
														break;
													}
													parent = parent.parentElement;
												}
											}
											else {
												tweetDiv.style.padding = '0px';
											}
										});
										// where the pp is (for each tweet)
										observeNthChild(tweetTopDiv, 0, softRemove);
									});

									tweet.style.padding = '0px';

									// where pinned is (for each tweet)
									observeNthChild(tweet, [0, 0, 0], softRemove);

									tweet.setAttribute('data-testid', 'modified-tweet');
								})
									.then(() => modifyTweet());
							}

							modifyTweet();
						});

						actualPrimaryColumn.style.width = '100vw';
						actualPrimaryColumn.style.maxWidth = '100vw';
						observeNthChild(actualPrimaryColumn, 0, topActualPrimaryColumn => {
							// profile banner
							observeNthChild(topActualPrimaryColumn, 0, softRemove);
							observeNthChild(topActualPrimaryColumn, 1, presentation => {
								presentation.style.margin = '0px';
								presentation.style.padding = '0px';
							});
						});
						// profile pp
						observeNthChild(actualPrimaryColumn, [0, 1, 0], softRemove);
					})
				});
			});
		});
	}

	let overviewGrid;
	let overlay;
	let currentImage;
	let currentSet = 0;
	let currentImageIndex = 0;
	let overlayVisible = false;
	let overviewVisible = false;
	let highlightedChannel = 0;

	function updateImage() {
		currentImage.src = imageSets[currentSet][currentImageIndex];
	}

	function toggleOverlay() {
		overlayVisible = !overlayVisible;
		overlay.style.display = overlayVisible ? 'flex' : 'none';
		if (overlayVisible) {
			highlightChannel(0);
		}
	}

	function toggleOverview() {
		overviewVisible = !overviewVisible;
		if (overviewVisible) {
			renderOverview();
			overviewGrid.style.display = 'grid';
		} else {
			overviewGrid.style.display = 'none';
		}
	}

	function renderOverview() {
		overviewGrid.innerHTML = '';
		imageSets
			.map(info => info)
			.flat()
			.slice(0, 35)
			.forEach((src) => {
				const img = document.createElement('img');
				img.src = src;
				overviewGrid.appendChild(img);
			});
	}

	function highlightChannel(index) {
		const channels = document.querySelectorAll('.channel');
		channels.forEach((channel, i) => {
			channel.classList.toggle('highlighted', i === index);
		});
		highlightedChannel = index;
	}

	function handleKeydownEvent(e) {
		if (overlayVisible) {
			if (e.key === 'ArrowUp') {
				highlightChannel(Math.max(0, highlightedChannel - 1));
			} else if (e.key === 'ArrowDown') {
				highlightChannel(
					Math.min(
						document.querySelectorAll('.channel').length - 1,
						highlightedChannel + 1
					)
				);
			} else if (e.key === 'Enter') {
				toggleOverlay();
			}
			e.preventDefault();
			return;
		}

		if (overviewVisible) {
			if (e.key === 'Escape') {
				toggleOverview();
			}
			e.preventDefault();
			return;
		}

		switch (e.code) {
			case 'ArrowRight':
				if (currentImageIndex < imageSets[currentSet].length - 1) {
					currentImageIndex++;
					updateImage();
				}
				break;
			case 'ArrowLeft':
				if (currentImageIndex > 0) {
					currentImageIndex--;
					updateImage();
				}
				break;
			case 'ArrowDown':
				if (currentSet < imageSets.length - 1) {
					currentSet++;
					currentImageIndex = 0;
					updateImage();
				}
				break;
			case 'ArrowUp':
				if (currentSet > 0) {
					currentSet--;
					currentImageIndex = 0;
					updateImage();
				}
				break;
			case 'Space':
				toggleOverlay();
				e.preventDefault();
				break;
			case 'Escape':
				toggleOverview();
				break;
		}
	}

	let isNavSysSetup = false;
	function setupNavigationSystem(column) {
		if (isNavSysSetup) return;

		// Create overlay and its channels
		overlay = document.createElement('div');
		overlay.classList.add('overlay');
		overlay.style.position = 'fixed';
		overlay.style.top = '0';
		overlay.style.left = '0';
		overlay.style.right = '0';
		overlay.style.bottom = '0';
		overlay.style.display = 'none'; // Initially hidden
		overlay.style.zIndex = '9999'; // Ensure it's above other elements
		document.body.appendChild(overlay);

		// Add hardcoded random channels
		const channels = ['Channel 1', 'Channel 2', 'Channel 3', 'Channel 4'];
		channels.forEach(name => {
			const channelElement = document.createElement('div');
			channelElement.classList.add('channel');
			channelElement.textContent = name;
			overlay.appendChild(channelElement);
		});

		// Create overview grid
		overviewGrid = document.createElement('div');
		overviewGrid.classList.add('overview-grid');
		overviewGrid.style.display = 'none'; // Initially hidden
		overviewGrid.style.position = 'fixed';
		overviewGrid.style.top = '0';
		overviewGrid.style.left = '0';
		overviewGrid.style.right = '0';
		overviewGrid.style.bottom = '0';
		overviewGrid.style.overflow = 'auto';
		overviewGrid.style.zIndex = '9998'; // Below overlay
		document.body.appendChild(overviewGrid);

		// Add the image container
		const imageContainer = document.createElement('div');
		imageContainer.id = 'image-container';
		column.appendChild(imageContainer);
		
		// Create img element for the first set
		currentImage = document.createElement('img');
		imageContainer.appendChild(currentImage);
		
		// Add CSS to make sure the image is fully visible and fills the container
		imageContainer.style.position = 'relative';
		imageContainer.style.width = '100vw';
		imageContainer.style.height = '100vh';
		imageContainer.style.overflow = 'hidden';
		currentImage.style.maxWidth = '100%';
		currentImage.style.maxHeight = '100%';
		currentImage.style.objectFit = 'contain'; // Ensures the image is fully visible

		document.removeEventListener('keydown', handleKeydownEvent);
		document.addEventListener('keydown', handleKeydownEvent);
		isNavSysSetup = true;
	}

	init();

	window.twitterInit ??= true;

});