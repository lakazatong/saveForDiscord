'use strict';

window.addEventListener('commonLoaded', () => {

	if (window?.twitterInit === true) return;

	let mediaCount;
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
	const tweetsMediasSubscribers = new Map();

	async function getTweet(tweetId) {
		function get(newTweets) {
			return newTweets.find(tweet => tweet.rest_id === tweetId);
		}
		let tweet = get(catchedTweets);
		if (!tweet) {
			await new Promise(function (resolve, reject) {
				const subsriberId = generateUUID();
				tweetMediaSrcsSubscribers.set(subsriberId, function (newTweets) {
					tweet = get(newTweets);
					if (tweet) {
						tweetMediaSrcsSubscribers.delete(subsriberId);
						resolve();
					}
				});
			});
		}
		// if (tweet.legacy.entities.media[0].type !== 'photo') return tweet;
		return tweet;
	}

	function getTweetMedias(tweet) {
		return tweet.legacy.entities.media.map(media => {
			const o = { type: media.type, src: media.media_url_https };
			if (o.type === 'video' || o.type === 'animated_gif') {
				o.type = 'video';
				o.src = media.video_info.variants.reduce((highest, current) => current.bitrate >= (highest.bitrate || 0) ? current : highest).url;
				o.width = media.original_info.width;
				o.height = media.original_info.height;
			}
			return o;
		});
	}

	function getMediaCount(tweet) {
		return tweet.core.user_results.result.legacy.media_count;
	}

	function getTweetCreatedAt(tweet) {
		return new Date(tweet.legacy.created_at).getTime();
	}

	// Injection logic

	console.log('twitter');
	window.documentReady = getDocumentReady.bind(document);

	const seenTweets = new Set();
	const tweets = [];

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
					const newTweets = rawTweets.map(raw => raw.item.itemContent.tweet_results.result);
					newTweets.forEach(newTweet => catchedTweets.push(newTweet));
					tweetMediaSrcsSubscribers.forEach(callback => callback(newTweets));
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
							if (tweets.length) setupNavigationSystem(actualPrimaryColumn);
						}

						// modify timeline's tweets
						observeNthChild(actualPrimaryColumn, [2, 1, 0], timeLine => {
							timeLine.querySelectorAll('li[role="listitem"]').forEach(liElement => {
								startObserver(liElement, () => liElement.querySelector('a[role="link"]'), e => e.tagName === 'A' && e.getAttribute('role') === 'link', async link => {
									const tweetId = extractTweetId(link.getAttribute('href'));
									if (seenTweets.has(tweetId)) return;
									seenTweets.add(tweetId);
									getTweet(tweetId).then(tweet => {
										if (!tweet) return;
										// mediaCount = Math.max(mediaCount, getMediaCount(tweet));
										mediaCount ??= getMediaCount(tweet);
										const newTweet = { createdAt: getTweetCreatedAt(tweet), medias: getTweetMedias(tweet), cur: 0 };
										insort(tweets, newTweet, media => -media.createdAt);
										setupNavigationSystem(actualPrimaryColumn);
										tweetsMediasSubscribers.forEach(callback => callback(newTweet));
										console.log(`got ${Math.round(tweets.length / mediaCount * 100, 2)}% of media`);
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
					})
				});
			});
		});
	}

	let overviewGrid;
	const overviewGridWidth = 7;
	const overviewGridHeight = 4;
	const overviewGridSize = overviewGridWidth * overviewGridHeight;
	let overviewBatchIndex = 0;

	let overlay;
	
	let mediaType;
	let mediaElement;
	let overviewMediaContainer;

	let mediaContainer;
	let tweetIndex = 0;
	const mediaIndex = {
		get(index) {
			return tweets[index].cur;
		},
		set(value, index, update) {
			tweets[index].cur = value;
			update();
		},
		increment(index, update) {
			tweets[index].cur++;
			update();
		},
		decrement(index, update) {
			tweets[index].cur--;
			update();
		}
	};
	let overlayVisible = false;
	let overviewVisible = false;
	let highlightedChannel = 0;
	const channels = ['Channel 1', 'Channel 2', 'Channel 3', 'Channel 4'];
	const toggleChannelsKeyCode = 'KeyC';
	const setOverviewKeyCode = 'KeyV';
	const toggleVideoFullScreenKeyCode = 'KeyF';

	const currentMedia = function () {
		const tweet = tweets?.[tweetIndex];
		if (!tweet) return;
		return tweet.medias[tweet.cur];
	}
	function updateMedia() {
		const newCur = currentMedia();
		if (!newCur) return;
		if (!mediaElement || newCur.type !== mediaType) {
			setupMediaElement(newCur);
		} else {
			mediaElement.src = newCur.src;
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

	function setOverview(set) {
		overviewVisible = set;
		if (overviewVisible) {
			mediaElement.style.display = 'none';
			overviewGrid.style.display = 'grid';

			overviewTweetIndex.set(tweetIndex);
			updateOverviewMedia();
			overviewGrid.addEventListener('keydown', handleKeydownEvent);
			overviewGrid.focus();
		} else {
			overviewGrid.style.display = 'none';
			mediaElement.style.removeProperty('display');

			updateMedia();
			mediaElement.addEventListener('keydown', handleKeydownEvent);
			mediaElement.focus();
		}
	}

	const overviewTweetIndex = {
		index: undefined,
		batchIndex: undefined,
		get() {
			return this.index % overviewGridSize;
		},
		set(newIndex) {
			if (newIndex === this.index) return;
			this.index = newIndex;
			const newBatchIndex = Math.floor(newIndex / overviewGridSize);
			
			if (newBatchIndex !== this.batchIndex) {
				this.batchIndex = newBatchIndex;
				renderOverview();
			} else {
				overviewMediaContainer?.classList.remove('overview-highlighted');
				overviewMediaContainer = overviewGrid.children[overviewTweetIndex.get()];
				overviewMediaContainer.classList.add('overview-highlighted');
			}
		},
		left() {
			this.set(this.index === 0 ? tweets.length - 1 : this.index - 1);
		},
		right() {
			this.set(this.index === tweets.length - 1 ? 0 : this.index + 1);
		},
		up() {
			if (this.index < overviewGridWidth) {
				let newIndex = tweets.length - 1;
				const left = newIndex % overviewGridWidth;
				this.set(newIndex - Math.max(0, left - this.index));
			} else {
				this.set(this.index - overviewGridWidth);
			}
		},
		down() {
			const overflow = tweets.length % overviewGridWidth;
			if (this.index >= (tweets.length - (overflow ? overflow : overviewGridWidth))) {
				this.set(this.index % overviewGridWidth);
			} else {
				this.set(Math.min(this.index + overviewGridWidth, tweets.length - 1));
			}
		}
	};

	function setupOverviewMediaElement(container, tweet) {
		const medias = tweet.medias;
		const media = medias[tweet.cur];
		
		let elm = container.querySelector(media.type === 'photo' ? 'img' : 'video');
		if (elm) {
			if (medias.length > 1) {
				const counter = container.querySelector('span');
				if (counter) counter.textContent = `${tweet.cur + 1}/${medias.length}`;
			}
		} else {
			container.innerHTML = '';
			elm = media.type === 'photo' ? document.createElement('img') : newVideoMediaElement();
			
			elm.classList.add('overview-grid-image');
			
			if (medias.length > 1) {
				elm.addEventListener(media.type === 'photo' ? 'load' : 'loadedmetadata', () => {
					
					// if (media.type === 'video') {
					// 	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
					// 	svg.setAttribute('width', '20%');
					// 	svg.setAttribute('padding-top', '20%');
					// 	svg.setAttribute('viewBox', '0 0 20 20');
					// 	svg.setAttribute('fill', 'white');
					// 	svg.style.position = 'absolute';
					// 	svg.style.top = '50%';
					// 	svg.style.left = '50%';
					// 	svg.style.transform = 'translate(-50%, -50%)';
					// 	svg.style.borderRadius = '50%';
					// 	svg.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
					// 	svg.innerHTML = `<polygon points="6,4 16,10 6,16" />`;
					// 	container.appendChild(svg);
					// }
					
					const counter = document.createElement('span');
					counter.setAttribute('width', '25%');
					counter.setAttribute('height', 'auto');
					counter.textContent = `${tweet.cur + 1}/${medias.length}`;
					counter.style.position = 'absolute';
					counter.style.bottom = '5%';
					counter.style.right = '7%';
					counter.style.color = 'white';
					container.appendChild(counter);
				
				}, { once: true });
			}
			container.appendChild(elm);
		}

		elm.src = media.src;
	}

	function renderOverview() {
		const start = overviewTweetIndex.batchIndex * overviewGridSize;
		const end = Math.min(start + overviewGridSize, mediaCount);
		let index = start;
		let localIndex;
		for (; index < end; index++) {
			localIndex = index % overviewGridSize;
			if (tweetsMediasSubscribers.get(localIndex)) tweetsMediasSubscribers.delete(localIndex);
			let tweet = tweets?.[index];
			const container = overviewGrid.children[localIndex];
			if (index === overviewTweetIndex.index) {
				container.classList.add('overview-highlighted');
				overviewMediaContainer = container;
			} else {
				container.classList.remove('overview-highlighted');
			}
			if (tweet) {
				setupOverviewMediaElement(container, tweet);
				continue;
			}
			container.innerHTML = '';
			tweetsMediasSubscribers.set(localIndex, function (newTweet) {
				tweet = tweets?.[index];
				if (!tweet) return;
				tweetsMediasSubscribers.delete(localIndex);
				setupOverviewMediaElement(container, tweet);
			});
		}
		while (++localIndex < overviewGridSize) {
			const container = overviewGrid.children[localIndex];
			container.innerHTML = '';
			container.classList.remove('overview-highlighted');
		}
		updateReactRootDims();
	}

	function highlightChannel(index) {
		document.querySelectorAll('.channel').forEach((channel, i) => {
			channel.classList.toggle('highlighted', i === index);
		});
		highlightedChannel = index;
	}

	function handleOverlayKeydownEvent(e) {
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
	}

	function updateOverviewMedia() {
		setupOverviewMediaElement(overviewMediaContainer, tweets[overviewTweetIndex.index]);
	}

	function handleOverviewKeydownEvent(e) {
		const index = overviewTweetIndex.index;
		switch (e.code) {
			case 'ArrowDown':
				overviewTweetIndex.down();
				e.preventDefault();
				break;
			case 'ArrowUp':
				overviewTweetIndex.up();
				e.preventDefault();
				break;
			case 'ArrowRight':
				if (e.shiftKey) {
					if (mediaIndex.get(index) < tweets[index].medias.length - 1) mediaIndex.increment(index, updateOverviewMedia);
				} else {
					overviewTweetIndex.right();
				}
				e.preventDefault();
				break;
			case 'ArrowLeft':
				if (e.shiftKey) {
					if (mediaIndex.get(index) > 0) mediaIndex.decrement(index, updateOverviewMedia);
				} else {
					overviewTweetIndex.left();
				}
				e.preventDefault();
				break;
			case 'Enter':
				tweetIndex = overviewTweetIndex.index;
				setOverview(false);
				e.preventDefault();
				break;
			case setOverviewKeyCode:
			case 'Escape':
				setOverview(false);
				e.preventDefault();
				break;
		}
	}

	async function handleKeydownEvent(e) {
		// console.log(e.code);
		if (overlayVisible) return handleOverlayKeydownEvent(e);
		if (overviewVisible) return handleOverviewKeydownEvent(e);
		
		if (!document.fullscreenElement) {
			switch (e.code) {
				case 'ArrowRight':
					if (mediaIndex.get(tweetIndex) < tweets[tweetIndex].medias.length - 1) mediaIndex.increment(tweetIndex, updateMedia);
					e.preventDefault();
					break;
				case 'ArrowLeft':
					if (mediaIndex.get(tweetIndex) > 0) mediaIndex.decrement(tweetIndex, updateMedia);
					e.preventDefault();
					break;
				case 'ArrowDown':
					if (tweetIndex < tweets.length - 1) {
						tweetIndex++;
						updateMedia();
					}
					e.preventDefault();
					break;
				case 'ArrowUp':
					if (tweetIndex > 0) {
						tweetIndex--;
						updateMedia();
					}
					e.preventDefault();
					break;
			}
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
				case toggleChannelsKeyCode:
					if (document.fullscreenElement) break;
					toggleChannels();
					e.preventDefault();
					break;
				case setOverviewKeyCode:
					if (document.fullscreenElement) break;
					setOverview(true);
					e.preventDefault();
					break;
			}
		} else {
			switch (e.code) {
				case toggleChannelsKeyCode:
					toggleChannels();
					e.preventDefault();
					break;
				case setOverviewKeyCode:
					setOverview(true);
					e.preventDefault();
					break;
			}
		}
	}

	function newVideoMediaElement() {
		const r = document.createElement('video');
		r.controls = r.autoplay = r.loop = true;
		return r;
	}

	function setupMediaElement(newCur) {
		mediaElement?.remove();
		mediaElement = null;
		
		if (newCur.type === 'photo') {
			mediaType = 'photo';
			mediaElement = document.createElement('img');
		} else {
			mediaType = 'video';
			mediaElement = newVideoMediaElement();
			mediaElement.style.width = newCur.width;
			mediaElement.style.height = newCur.height;
		}

		mediaElement.src = newCur.src;
		mediaElement.setAttribute('tabindex', '0');

		mediaElement.style.maxWidth = '100%';
		mediaElement.style.maxHeight = '100%';
		mediaElement.style.objectFit = 'contain';
		mediaElement.style.border = '0';

		mediaElement.addEventListener('keydown', handleKeydownEvent);
		mediaContainer.appendChild(mediaElement);
		mediaElement.focus();
	}

	function setupOverviewGrid() {
		for (let i = 0; i < overviewGridSize; i++) {
			const container = document.createElement('div');

			container.style.display = 'contents';
			container.style.position = 'relative';
			container.style.display = 'inline-block';

			overviewGrid.appendChild(container);
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

		if (!column.querySelector('div[id="media-container"]')) {

			mediaContainer = document.createElement('div');
			mediaContainer.id = 'media-container';
			mediaContainer.style.position = 'relative';
			mediaContainer.style.overflow = 'hidden';
			column.appendChild(mediaContainer);

			setupMediaElement(currentMedia());

			overviewGrid = document.createElement('div');
			overviewGrid.setAttribute('tabindex', '0');
			overviewGrid.style.objectFit = 'contain';
			overviewGrid.style.display = 'none';
			overviewGrid.style.gridTemplateColumns = `repeat(${overviewGridWidth}, 1fr)`;
			overviewGrid.style.gridTemplateRows = `repeat(${overviewGridHeight}, 1fr)`;
			overviewGrid.style.gap = '2px';

			setupOverviewGrid();

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