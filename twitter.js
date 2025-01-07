'use strict';

window.addEventListener('commonLoaded', () => {

	if (window?.twitterInit === true) return;

	const catchedTweets = [];

	function getReactRootDims() {
		const reactRoot = document.getElementById('react-root');
		return [reactRoot.offsetWidth - 1, reactRoot.offsetHeight - 1];
	}

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

	const tweetMediaSrcsSubscribers = new Map();

	async function getTweetInfo(tweetId) {
		function getInfo(tweets) {
			return tweets.find(tweet => tweet.rest_id === tweetId);
		}
		let tweetInfo = getInfo(catchedTweets);
		if (!tweetInfo) {
			await new Promise(function (resolve, reject) {
				const subsriberId = generateUUID();
				tweetMediaSrcsSubscribers.set(subsriberId, function (newTweets) {
					tweetInfo = getInfo(newTweets);
					if (tweetInfo) {
						tweetMediaSrcsSubscribers.delete(subsriberId);
						resolve();
					}
				});
			});
		}
		return tweetInfo;
	}

	function getTweetMediaSrcs(tweetInfo) {
		// ignore videos for now (will take their video thumbnails)
		return tweetInfo.legacy.entities.media.map(media =>
			// media.type === 'video'
			// 	? media.video_info.variants.reduce((highest, current) => current.bitrate > (highest.bitrate || 0) ? current : highest).url
			// 	: media.media_url_https
			media.media_url_https
		);
	}

	function getTweetCreatedAt(tweetInfo) {
		return new Date(tweetInfo.legacy.created_at).getTime();
	}

	// Injection logic

	console.log('twitter');
	window.documentReady = getDocumentReady.bind(document);

	const seenTweets = new Set();
	const medias = [];

	function init() {
		if (document.querySelector(`*[id="${window.uuid}"]`)) return;

		const marker = document.createElement('div');
		marker.id = window.uuid;
		document.body.appendChild(marker);

		window.addEventListener('message', function (event) {
			if (event.source == window && event.data && event.data.action == 'UserMediaResponse') {
				const body = JSON.parse(event.data.body);
				// console.log('UserMediaResponse', body);
				const instructions = body.data.user.result.timeline_v2.timeline.instructions;
				let rawTweets = instructions.find(obj => obj.type === 'TimelineAddToModule')?.moduleItems;
				if (!rawTweets) {
					const entries = instructions.find(obj => obj.type === 'TimelineAddEntries').entries;
					rawTweets = entries.find(item => !item.entryId.startsWith('cursor'))?.content.items;
				}
				if (rawTweets) {
					const tweets = rawTweets.map(tweet => tweet.item.itemContent.tweet_results.result);
					tweets.forEach(tweet => catchedTweets.push(tweet));
					tweetMediaSrcsSubscribers.forEach(callback => callback(tweets));
				}
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
						// hacky but it works
						const actualPrimaryColumnWidth = `${getReactRootDims()[0]}px`;
						actualPrimaryColumn.style.width = actualPrimaryColumnWidth;
						actualPrimaryColumn.style.maxWidth = actualPrimaryColumnWidth;
						// remove the content of the media page
						document.removeEventListener('keydown', handleKeydownEvent);
						if (document.location.href.endsWith('media')) {
							startObserver(actualPrimaryColumn, () => actualPrimaryColumn.querySelector('section[role="region"]'), e => e.tagName === 'SECTION' && e.getAttribute('role') === 'region', softRemove);
							if (medias.length) setupNavigationSystem(actualPrimaryColumn);
							document.addEventListener('keydown', handleKeydownEvent);
						}

						// modify timeline's tweets
						observeNthChild(actualPrimaryColumn, [2, 1, 0], timeLine => {
							timeLine.querySelectorAll('li[role="listitem"]').forEach(liElement => {
								startObserver(liElement, () => liElement.querySelector('a[role="link"]'), e => e.tagName === 'A' && e.getAttribute('role') === 'link', async link => {
									const tweetId = extractTweetId(link.getAttribute('href'));
									if (seenTweets.has(tweetId)) return;
									seenTweets.add(tweetId);
									getTweetInfo(tweetId).then(tweetInfo => {
										insort(medias, { createdAt: getTweetCreatedAt(tweetInfo), srcs: getTweetMediaSrcs(tweetInfo) }, media => media.createdAt)
										setupNavigationSystem(actualPrimaryColumn);
									});
									if (currentImage && (!currentImage.src || currentImage.src.includes('undefined'))) updateImage();
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
					})
				});
			});
		});
	}

	let overviewGrid;
	let overlay;
	let currentImage;
	let imageContainer;
	let currentSet = 0;
	let currentImageIndex = 0;
	let overlayVisible = false;
	let overviewVisible = false;
	let highlightedChannel = 0;
	const channels = ['Channel 1', 'Channel 2', 'Channel 3', 'Channel 4'];

	function updateImage() {
		currentImage.src = medias?.[currentSet]?.srcs[currentImageIndex];
	}

	function toggleOverlay() {
		overlayVisible = !overlayVisible;
		if (overlayVisible) {
			highlightChannel(0);
			overlay.style.display = 'flex';
		} else {
			overlay.style.display = 'none';
		}
	}

	function toggleOverview() {
		overviewVisible = !overviewVisible;
		if (overviewVisible) {
			renderOverview();
			overviewGrid.style.display = 'grid';
			currentImage.style.display = 'none';
		} else {
			overviewGrid.style.display = 'none';
			currentImage.style.removeProperty('display');
		}
	}
	
	function renderOverview() {
		overviewGrid.innerHTML = '';
		medias
			.map(media => media.srcs[0])
			.slice(0, 50)
			.forEach((src) => {
				const img = document.createElement('img');
				img.src = src;
				img.style.width = '100%';
				img.style.height = '100%';
				img.style.objectFit = 'cover';
				img.style.objectPosition = 'center';
				img.style.margin = '0';
				img.style.display = 'block';
				overviewGrid.appendChild(img);
			});
	}

	function highlightChannel(index) {
		document.querySelectorAll('.channel').forEach((channel, i) => {
			channel.classList.toggle('highlighted', i === index);
		});
		highlightedChannel = index;
	}

	function handleKeydownEvent(e) {
		if (overlayVisible) {
			switch (e.code) {
				case 'ArrowDown':
					highlightChannel(
						Math.min(
							document.querySelectorAll('.channel').length - 1,
							highlightedChannel + 1
						)
					);
					e.preventDefault();
					break;
				case 'ArrowUp':
					highlightChannel(Math.max(0, highlightedChannel - 1));
					e.preventDefault();
					break;
				case 'Space':
				case 'Escape':
					toggleOverlay();
					e.preventDefault();
					break;
				case 'Enter':
					console.log('selected channel:', channels[highlightedChannel]);
					toggleOverlay();
					e.preventDefault();
					break;
			}
			return;
		}

		if (overviewVisible) {
			if (e.code === 'Escape') {
				toggleOverview();
			}
			e.preventDefault();
			return;
		}

		switch (e.code) {
			case 'ArrowRight':
				if (currentImageIndex < medias[currentSet].srcs.length - 1) {
					currentImageIndex++;
					updateImage();
				}
				e.preventDefault();
				break;
			case 'ArrowLeft':
				if (currentImageIndex > 0) {
					currentImageIndex--;
					updateImage();
				}
				e.preventDefault();
				break;
			case 'ArrowDown':
				if (currentSet < medias.length - 1) {
					currentSet++;
					currentImageIndex = 0;
					updateImage();
				}
				e.preventDefault();
				break;
			case 'ArrowUp':
				if (currentSet > 0) {
					currentSet--;
					currentImageIndex = 0;
					updateImage();
				}
				e.preventDefault();
				break;
			case 'Space':
				toggleOverlay();
				e.preventDefault();
				break;
			case 'Escape':
				toggleOverview();
				e.preventDefault();
				break;
		}
	}

	let isNavSysSetup = false;
	function setupNavigationSystem(column) {
		if (!isNavSysSetup) {
			// Create overlay and its channels
			overlay = document.createElement('div');
			overlay.classList.add('overlay');
			overlay.style.position = 'fixed';
			overlay.style.top = '0';
			overlay.style.left = '0';
			overlay.style.right = '0';
			overlay.style.bottom = '0';
			overlay.style.display = 'none';
			overlay.style.zIndex = '9999';
			document.body.appendChild(overlay);

			channels.forEach(name => {
				const channelElement = document.createElement('div');
				channelElement.classList.add('channel');
				channelElement.textContent = name;
				overlay.appendChild(channelElement);
			});

			isNavSysSetup = true;
		}

		if (!column.querySelector('div[id="image-container"]')) {

			imageContainer = document.createElement('div');
			imageContainer.style.userSelect = 'none';
			imageContainer.id = 'image-container';
			imageContainer.style.position = 'relative';
			imageContainer.style.overflow = 'hidden';
			column.appendChild(imageContainer);

			currentImage = document.createElement('img');
			currentImage.style.userSelect = 'none';
			currentImage.style.maxWidth = '100%';
			currentImage.style.maxHeight = '100%';
			currentImage.style.objectFit = 'contain';
			imageContainer.appendChild(currentImage);
			
			overviewGrid = document.createElement('div');
			overviewGrid.style.userSelect = 'none';
			overviewGrid.style.position = 'relative';
			overviewGrid.style.overflow = 'hidden';
			overviewGrid.style.display = 'grid';
			overviewGrid.style.gridTemplateColumns = 'repeat(10, 1fr)';
			overviewGrid.style.gridTemplateRows = 'repeat(5, 1fr)';
			overviewGrid.style.gap = '2px';
			overviewGrid.style.top = '0';
			overviewGrid.style.left = '0';
			overviewGrid.style.right = '0';
			overviewGrid.style.bottom = '0';
			imageContainer.appendChild(overviewGrid);

			updateImage();
		}

		const [reactRootWidth,reactRootHeight] = getReactRootDims();
		imageContainer.style.width = `${reactRootWidth}px`;
		imageContainer.style.maxWidth = `${reactRootWidth}px`;
		imageContainer.style.height = `${reactRootHeight}px`;
		imageContainer.style.maxHeight = `${reactRootHeight}px`;

		overviewGrid.style.maxWidth = `${reactRootWidth}px`;
		overviewGrid.style.width = `${reactRootWidth}px`;
		overviewGrid.style.height = `${reactRootHeight}px`;
		overviewGrid.style.maxHeight = `${reactRootHeight}px`;

	}

	init();

	window.twitterInit ??= true;

});