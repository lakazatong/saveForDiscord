'use strict';

window.addEventListener('commonLoaded', () => {

	if (window?.twitterInit === true) return;

	const catchedTweets = [];

	function getReactRootDims() {
		const reactRoot = document.getElementById('react-root');
		return [reactRoot.offsetWidth - 1, reactRoot.offsetHeight - 1];
	}
	
	function updateReactRootDims() {
		const reactRoot = document.getElementById('react-root');
		reactRoot?.style.setProperty('--overview-grid-image-width', `${Math.floor((reactRoot.offsetWidth - 1) / overviewGridWidth)}px`);
		reactRoot?.style.setProperty('--overview-grid-image-height', `${Math.floor((reactRoot.offsetHeight - 1) / overviewGridHeight)}px`);
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
		if (tweetInfo.legacy.entities.media[0].type !== 'photo') return tweetInfo;
	}

	function getTweetMedias(tweetInfo) {
		return tweetInfo.legacy.entities.media.map(media => {
			const o = { type: media.type, preview: media.media_url_https, src: media.media_url_https };
			if (o.type === 'video' || o.type === 'animated_gif') {
				o.type = 'video';
				o.src = media.video_info.variants.reduce((highest, current) => current.bitrate >= (highest.bitrate || 0) ? current : highest).url;
				o.width = media.original_info.width;
				o.height = media.original_info.height;
				// console.log(media);
			}
			return o;
		});
	}

	function getTweetCreatedAt(tweetInfo) {
		return new Date(tweetInfo.legacy.created_at).getTime();
	}

	// Injection logic

	console.log('twitter');
	window.documentReady = getDocumentReady.bind(document);

	const seenTweets = new Set();
	const tweetsMedias = [];

	function init() {
		if (document.querySelector(`*[id="${window.uuid}"]`)) return;

		const marker = document.createElement('div');
		marker.id = window.uuid;
		document.body.appendChild(marker);

		window.addEventListener('resize', updateReactRootDims);
		new ResizeObserver(updateReactRootDims).observe(document.getElementById('react-root'));

		window.addEventListener('message', function (event) {
			if (event.source == window && event.data && event.data.action === 'UserMediaResponse') {
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
						if (document.location.href.endsWith('media')) {
							startObserver(actualPrimaryColumn, () => actualPrimaryColumn.querySelector('section[role="region"]'), e => e.tagName === 'SECTION' && e.getAttribute('role') === 'region', softRemove);
							if (tweetsMedias.length) setupNavigationSystem(actualPrimaryColumn);
						}

						// modify timeline's tweets
						observeNthChild(actualPrimaryColumn, [2, 1, 0], timeLine => {
							timeLine.querySelectorAll('li[role="listitem"]').forEach(liElement => {
								startObserver(liElement, () => liElement.querySelector('a[role="link"]'), e => e.tagName === 'A' && e.getAttribute('role') === 'link', async link => {
									const tweetId = extractTweetId(link.getAttribute('href'));
									if (seenTweets.has(tweetId)) return;
									seenTweets.add(tweetId);
									getTweetInfo(tweetId).then(tweetInfo => {
										if (!tweetInfo) return;
										insort(tweetsMedias, { createdAt: getTweetCreatedAt(tweetInfo), medias: getTweetMedias(tweetInfo) }, media => -media.createdAt)
										setupNavigationSystem(actualPrimaryColumn);
									});
									if (mediaElement && mediaElement.src.includes('undefined')) updateMedia();
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
	const overviewGridWidth = 7;
	const overviewGridHeight = 4;
	let overviewBatchIndex = 0;
	let overlay;
	let mediaType;
	let mediaElement;
	let mediaContainer;
	let currentTweetIndex = 0;
	let currentMediaIndex = 0;
	let overlayVisible = false;
	let overviewVisible = false;
	let highlightedChannel = 0;
	const channels = ['Channel 1', 'Channel 2', 'Channel 3', 'Channel 4'];
	const toggleChannelsKeyCode = 'KeyC';
	const toggleOverviewKeyCode = 'KeyV';
	const toggleVideoFullScreenKeyCode = 'KeyF';

	const currentMedia = () => tweetsMedias?.[currentTweetIndex]?.medias[currentMediaIndex];
	function updateMedia(forceSetup = false) {
		const newCur = currentMedia();
		if (forceSetup || newCur.type !== mediaType) {
			setupMediaElement(newCur);
			console.log('updateMedia: changed media type');
		} else {
			mediaElement.src = newCur.src;
			console.log('updateMedia: changed src');
		}
	}

	function toggleChannels() {
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
			overviewGrid.style.display = 'grid';
			// not to lose focus with display: none
			mediaElement.style.position = 'absolute';
			mediaElement.style.left = '-9999px';
			
			renderOverview();
		} else {
			overviewGrid.style.display = 'none';
			mediaElement.style.position = 'static';
			mediaElement.style.removeProperty('left');
		}
	}
		
	function renderOverview() {
		overviewGrid.innerHTML = '';
		const start = overviewBatchIndex * overviewGridWidth * overviewGridHeight;
		const end = start + overviewGridWidth * overviewGridHeight;
		tweetsMedias
			.map(tweet => tweet.medias[0].preview)
			.slice(start, end)
			.forEach(src => {
				const img = document.createElement('img');
				img.src = src;
				img.classList.add('overview-grid-image');
				overviewGrid.appendChild(img);
			});
		updateReactRootDims();
	}

	function highlightChannel(index) {
		document.querySelectorAll('.channel').forEach((channel, i) => {
			channel.classList.toggle('highlighted', i === index);
		});
		highlightedChannel = index;
	}

	function handleKeydownEvent(e) {
		// console.log(e.code);
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
				case 'Enter':
					console.log('selected channel:', channels[highlightedChannel]);
					toggleChannels();
					e.preventDefault();
					break;
				case toggleChannelsKeyCode:
				case 'Escape':
					toggleChannels();
					e.preventDefault();
					break;
			}
			return;
		}

		if (overviewVisible) {
			switch (e.code) {
				case 'ArrowDown':
					if (
						(overviewBatchIndex + 1) * overviewGridWidth * overviewGridHeight <
						tweetsMedias.length
					) {
						overviewBatchIndex++;
						renderOverview();
					}
					e.preventDefault();
					break;
				case 'ArrowUp':
					if (overviewBatchIndex > 0) {
						overviewBatchIndex--;
						renderOverview();
					}
					e.preventDefault();
					break;
				case toggleOverviewKeyCode:
				case 'Escape':
					toggleOverview();
					e.preventDefault();
					break;
			}
			return;
		}

		switch (e.code) {
			case 'ArrowRight':
				if (currentMediaIndex < tweetsMedias[currentTweetIndex].medias.srcs.length - 1) {
					currentMediaIndex++;
					updateMedia();
				}
				e.preventDefault();
				break;
			case 'ArrowLeft':
				if (currentMediaIndex > 0) {
					currentMediaIndex--;
					updateMedia();
				}
				e.preventDefault();
				break;
			case 'ArrowDown':
				if (currentTweetIndex < tweetsMedias.length - 1) {
					currentTweetIndex++;
					currentMediaIndex = 0;
					updateMedia();
				}
				e.preventDefault();
				break;
			case 'ArrowUp':
				if (currentTweetIndex > 0) {
					currentTweetIndex--;
					currentMediaIndex = 0;
					updateMedia();
				}
				e.preventDefault();
				break;
			case toggleChannelsKeyCode:
				toggleChannels();
				e.preventDefault();
				break;
			case toggleOverviewKeyCode:
				toggleOverview();
				e.preventDefault();
				break;
		}
		if (mediaType === 'video') {
			switch (e.code) {
				case toggleVideoFullScreenKeyCode:
					if (document.fullscreenElement) {
						document.exitFullscreen();
					} else {
						mediaElement.requestFullscreen();
					}
					e.preventDefault();
					break;
			}
		}
	}

	function setupMediaElement(newCur) {
		mediaElement?.remove();
		if (newCur.type === 'video') {
			mediaType = 'video';
			mediaElement = document.createElement('video');

			mediaElement.src = newCur.src;
			mediaElement.controls = true;
			mediaElement.autoplay = true;
			mediaElement.tabIndex = 0
			mediaElement.style.width = newCur.width;
			mediaElement.style.height = newCur.height;

			mediaElement.addEventListener('keydown', handleKeydownEvent);
			mediaContainer.appendChild(mediaElement);
			mediaElement.focus();
		} else {
			mediaType = 'photo';
			mediaElement = document.createElement('img');

			mediaElement.src = newCur.src;
			mediaElement.tabindex = '0';

			mediaElement.addEventListener('keydown', handleKeydownEvent);
			mediaContainer.appendChild(mediaElement);
			mediaElement.focus();
		}
		mediaElement.style.maxWidth = '100%';
		mediaElement.style.maxHeight = '100%';
		mediaElement.style.objectFit = 'contain';
		mediaElement.style.border = '0';
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

		if (!column.querySelector('div[id="media-container"]')) {

			mediaContainer = document.createElement('div');
			// mediaContainer.style.userSelect = 'none';
			mediaContainer.id = 'media-container';
			mediaContainer.style.position = 'relative';
			mediaContainer.style.overflow = 'hidden';
			column.appendChild(mediaContainer);

			updateMedia(true);

			overviewGrid = document.createElement('div');
			// overviewGrid.style.userSelect = 'none';
			overviewGrid.style.objectFit = 'contain';
			overviewGrid.style.display = 'none';
			overviewGrid.style.gridTemplateColumns = `repeat(${overviewGridWidth}, 1fr)`;
			overviewGrid.style.gridTemplateRows = `repeat(${overviewGridHeight}, 1fr)`;
			overviewGrid.style.gap = '2px';
			mediaContainer.appendChild(overviewGrid);
		}

		const [reactRootWidth,reactRootHeight] = getReactRootDims();
		mediaContainer.style.width = `${reactRootWidth}px`;
		mediaContainer.style.maxWidth = `${reactRootWidth}px`;
		mediaContainer.style.height = `${reactRootHeight}px`;
		mediaContainer.style.maxHeight = `${reactRootHeight}px`;

		overviewGrid.style.maxWidth = `${reactRootWidth}px`;
		overviewGrid.style.width = `${reactRootWidth}px`;
		overviewGrid.style.height = `${reactRootHeight}px`;
		overviewGrid.style.maxHeight = `${reactRootHeight}px`;
	}

	init();

	window.twitterInit ??= true;

});