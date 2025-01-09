'use strict';

window.addEventListener('commonLoaded', () => {

	if (window?.twitterInit === true) return;

	let tweetsCount;
	const catchedTweets = [];

	let insertMediaSection = new DeferredFunction();
	let requestMoreTweets = new DeferredFunction();

	function ensureAtLeastOneOverviewGrid() {
		if (tweets.length >= overviewGridSize || tweets.length === tweetsCount) return;
		requestMoreTweets.call();
	}

	function getReactRootDims() {
		const reactRoot = document.getElementById('react-root');
		return [reactRoot.offsetWidth - 1, reactRoot.offsetHeight - 1];
	}
	
	function updateReactRootDims() {
		const reactRoot = document.getElementById('react-root');
		const w = Math.floor((reactRoot.offsetWidth - 1) / overviewGridWidth);
		const h = Math.floor((reactRoot.offsetHeight - 1) / overviewGridHeight);
		reactRoot?.style.setProperty('--overview-grid-image-width', `${w}px`);
		reactRoot?.style.setProperty('--overview-grid-image-height', `${h}px`);
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

	const newTweetsSubscribers = new Map();

	function getTweetMedias(newTweet) {
		return newTweet.legacy.entities.media.map(media => {
			const o = { type: media.type, src: media.media_url_https };
			if (o.type === 'video' || o.type === 'animated_gif') {
				o.type = 'video';
				o.src = media.video_info.variants.reduce(
					(highest, current) => current.bitrate >= (highest.bitrate || 0) ? current : highest
				).url;
				o.width = media.original_info.width;
				o.height = media.original_info.height;
				o.currentTime = 0;
			}
			return o;
		});
	}

	function getMediaCount(newTweet) {
		return newTweet.core.user_results.result.legacy.media_count;
	}

	function getTweetCreatedAt(newTweet) {
		return new Date(newTweet.legacy.created_at).getTime();
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
				console.log('UserMediaResponse', body);
				const instructions = body.data.user.result.timeline_v2.timeline.instructions;
				let rawTweets = instructions.find(obj => obj.type === 'TimelineAddToModule')?.moduleItems;
				if (!rawTweets) {
					const entries = instructions.find(obj => obj.type === 'TimelineAddEntries').entries;
					rawTweets = entries.find(item => !item.entryId.startsWith('cursor'))?.content.items;
					if (!rawTweets) return;
				}

				const newTweets = rawTweets.map(raw => raw.item.itemContent.tweet_results.result);
				newTweets.forEach(newTeet => {
					if (seenTweets.has(newTeet.rest_id)) return;
					seenTweets.add(newTeet.rest_id);
					tweetsCount ??= getMediaCount(newTeet);
					const tweet = { createdAt: getTweetCreatedAt(newTeet), medias: getTweetMedias(newTeet), cur: 0 };
					insort(tweets, tweet, media => -media.createdAt);
					newTweetsSubscribers.forEach(callback => callback(newTeet));
				});
				const percentage = Math.round(tweets.length / tweetsCount * 100, 2);
				console.log(`got ${tweets.length}/${tweetsCount} media tweets (${percentage}%)`);
				ensureAtLeastOneOverviewGrid();
				insertMediaSection.call();
			}
		});

		function timelineCallback(timeline) {
			timeline.style.minHeight = '0';
			requestMoreTweets.define(function () {
				Array.from(timeline.children).forEach(softRemove);
			});

			// timeline.querySelectorAll('li[role="listitem"]').forEach(liElement => {
			// 	startObserver(liElement,
			// 		() => liElement.querySelector('a[role="link"]'),
			// 		e => e.tagName === 'A' && e.getAttribute('role') === 'link',
			// 		async link => { }
			// 	);
			// });

			// modify timeline's tweets
			function modifyTweet() {
				// console.log('modifyTweet called');
				getStartAttributeObserver(timeline)('article', 'data-testid', 'tweet', tweet => {
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
		}

		function actualPrimaryColumnCallback(actualPrimaryColumn) {
			observeNthChild(actualPrimaryColumn, 0, topActualPrimaryColumn => {
				// profile banner
				observeNthChild(topActualPrimaryColumn, 0, softRemove);
				observeNthChild(topActualPrimaryColumn, 1, presentation => {
					presentation.style.margin = presentation.style.padding = '0px';
				});
			});
			// profile pp
			observeNthChild(actualPrimaryColumn, [0, 1, 0], softRemove);
			// hacky but it works
			actualPrimaryColumn.style.width = actualPrimaryColumn.style.maxWidth = `${getReactRootDims()[0]}px`;
			
			// hides the content of the media page
			if (!document.location.href.endsWith('media')) return;
			
			function mediaSectionCallback(mediaSection) {
				mediaSection.style.position = 'relative';
				mediaSection.style.overflow = 'hidden';
				observeNthChild(mediaSection, [1, 0], timelineCallback);
				insertMediaSection.define(function () {
					if (!actualPrimaryColumn.querySelector('div[id="media-container"]'))
						actualPrimaryColumn.insertBefore(setupNavigationSystem(), mediaSection);
				});
			}
			startObserver(actualPrimaryColumn,
				() => actualPrimaryColumn.querySelector('section[role="region"]'),
				e => e.tagName === 'SECTION' && e.getAttribute('role') === 'region',
				mediaSectionCallback
			);
		}

		function homeTimelineCallback(homeTimeline) {
			// sticky top back and follow button with tweeter profile's name and posts count
			observeNthChild(homeTimeline, 0, softRemove);
			observeNthChild(homeTimeline, [2, 0, 0], actualPrimaryColumnCallback);
		}

		function primaryColumnCallback(primaryColumn) {
			primaryColumn.style.border = '0px';
			observeNthChild(primaryColumn, 0, homeTimelineCallback);
		}

		observeElementChanges(document.body, body => {
			const startAttributeObserver = getStartAttributeObserver(body);
			// left side column
			startAttributeObserver('header', 'role', 'banner', softRemove);
			// right side column
			startAttributeObserver('div', 'data-testid', 'sidebarColumn', softRemove);
			// self explainatory
			startAttributeObserver('div', 'data-testid', 'DMDrawer', softRemove);
			startAttributeObserver('div', 'data-testid', 'primaryColumn', primaryColumnCallback);
		});
	}

	let overviewGrid;
	const overviewGridWidth = 8;
	const overviewGridHeight = 5;
	const overviewGridSize = overviewGridWidth * overviewGridHeight;
	let overviewBatchIndex = 0;

	// let overlay;
	
	let mediaElement;
	let overviewMediaContainer;

	let tweetIndex = 0;
	const mediaIndex = {
		get: index => tweets[index].cur,
		increment: index => tweets[index].cur++,
		decrement: index => tweets[index].cur--
	};
	// let overlayVisible = false;
	let overviewVisible = false;
	let highlightedChannel = 0;
	const channels = ['Channel 1', 'Channel 2', 'Channel 3', 'Channel 4'];
	const toggleChannelsKeyCode = 'KeyC';
	const setOverviewKeyCode = 'KeyV';
	const toggleVideoFullScreenKeyCode = 'KeyF';

	function saveCurrentTime(elm, index) {
		if (elm.currentTime >= 0) {
			const tweet = tweets[index];
			tweet.medias[tweet.cur].currentTime = elm.currentTime;
		}
	}

	function currentMedia(index) {
		const tweet = tweets?.[index];
		if (!tweet) return;
		return tweet.medias[tweet.cur];
	}

	function mediaElementType() {
		return mediaElement.tagName === 'IMG' ? 'photo' : 'video';
	}

	function updateMedia(index) {
		const media = currentMedia(index ?? tweetIndex);
		if (!media) return;
		saveCurrentTime(mediaElement, tweetIndex);
		if (media.type === mediaElementType()) {
			mediaElement.src = media.src;
			if (mediaElement.currentTime >= 0) mediaElement.currentTime = media.currentTime;
			mediaElement.focus();
		} else {
			setupMediaElement(media);
		}
		tweetIndex = index;
	}

	// function toggleChannels() {
	// 	overlayVisible = !overlayVisible;
	// 	if (overlayVisible) {
	// 		highlightChannel(0);
	// 		overlay.style.display = 'flex';
	// 	} else {
	// 		overlay.style.display = 'none';
	// 	}
	// }

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
				overviewMediaContainer.classList.remove('overview-highlighted');
				let elm = overviewMediaContainer.querySelector('video');
				if (elm) {
					elm.pause();
					addPlayIcon(overviewMediaContainer);
				}
				overviewMediaContainer = overviewGrid.children[overviewTweetIndex.get()];
				overviewMediaContainer.classList.add('overview-highlighted');
				elm = overviewMediaContainer.querySelector('video');
				if (elm) {
					elm.play();
					overviewMediaContainer.querySelector('svg').remove();
				}
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

	function addPlayIcon(container) {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', '20%');
		svg.setAttribute('padding-top', '20%');
		svg.setAttribute('viewBox', '0 0 20 20');
		svg.setAttribute('fill', 'white');
		svg.style.position = 'absolute';
		svg.style.top = '50%';
		svg.style.left = '50%';
		svg.style.transform = 'translate(-50%, -50%)';
		svg.style.borderRadius = '50%';
		svg.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
		svg.innerHTML = `<polygon points="6,4 16,10 6,16" />`;
		container.appendChild(svg);
		return svg;
	}

	function addCounter(container) {
		const counter = document.createElement('span');
		counter.setAttribute('width', '25%');
		counter.setAttribute('height', 'auto');
		counter.style.position = 'absolute';
		counter.style.bottom = '5%';
		counter.style.right = '7%';
		counter.style.color = 'white';
		container.appendChild(counter);
		return counter;
	}

	function setupOverviewMediaElement(container, tweet, isSelected, mark = false) {
		return new Promise((resolve) => {
			const medias = tweet.medias;
			const media = medias[tweet.cur];
			const uuid = mark ? generateUUID() : undefined;

			let elm;
			if (media.type === 'photo') {
				elm = document.createElement('img');
				elm.src = media.src;
			} else {
				elm = newVideoMediaElement(false);
				elm.src = media.src;
				if (isSelected) {
					elm.play();
				} else {
					const playIcon = addPlayIcon(container);
					if (mark) playIcon.setAttribute('data-uuid', uuid);
				}
			}

			elm.classList.add('overview-grid-image');
			if (mark) elm.setAttribute('data-uuid', uuid);
			container.appendChild(elm);

			if (medias.length > 1) {
				elm.addEventListener(
					media.type === 'photo' ? 'load' : 'loadedmetadata',
					() => {
						const counter = addCounter(container);
						counter.textContent = `${tweet.cur + 1}/${medias.length}`;
						if (mark) counter.setAttribute('data-uuid', uuid);
						resolve(uuid);
					},
					{ once: true }
				);
			} else {
				resolve(uuid);
			}
		});
	}

	function renderOverview() {
		const start = overviewTweetIndex.batchIndex * overviewGridSize;
		const end = Math.min(start + overviewGridSize, tweetsCount);
		let i = start;
		for (; i < end; i++) {
			const index = i;
			const localIndex = index % overviewGridSize;
			if (newTweetsSubscribers.get(localIndex)) newTweetsSubscribers.delete(localIndex);
			const tweet = tweets?.[index];
			const container = overviewGrid.children[localIndex];
			let tmp = false;
			if (index === overviewTweetIndex.index) {
				tmp = true;
				container.classList.add('overview-highlighted');
				overviewMediaContainer = container;
			} else {
				container.classList.remove('overview-highlighted');
			}
			const isSelected = tmp;
			container.innerHTML = '';
			if (tweet) {
				setupOverviewMediaElement(container, tweet, isSelected);
				continue;
			}
			newTweetsSubscribers.set(localIndex, function (newTweet) {
				const t = tweets?.[index];
				if (!t) return;
				newTweetsSubscribers.delete(localIndex);
				setupOverviewMediaElement(container, t, isSelected);
			});
		}
		i %= overviewGridSize;
		if (i > 0) {
			while (i < overviewGridSize) {
				const container = overviewGrid.children[i++];
				container.innerHTML = '';
				container.classList.remove('overview-highlighted');
			}
		}
		updateReactRootDims();
	}

	async function updateOverviewMedia() {
		const container = overviewMediaContainer;
		const tweet = tweets[overviewTweetIndex.index];

		const uuid = await setupOverviewMediaElement(container, tweet, true, true);

		Array.from(container.querySelectorAll(`:scope > *`)).forEach((child) => {
			if (child.getAttribute('data-uuid') === uuid) {
				child.removeAttribute('data-uuid');
			} else {
				container.removeChild(child);
			}
		});
	}

	function highlightChannel(index) {
		document.querySelectorAll('.channel').forEach((channel, i) => {
			channel.classList.toggle('highlighted', i === index);
		});
		highlightedChannel = index;
	}

	// function handleOverlayKeydownEvent(e) {
	// 	switch (e.code) {
	// 		case 'ArrowDown':
	// 			highlightChannel(
	// 				Math.min(
	// 					document.querySelectorAll('.channel').length - 1,
	// 					highlightedChannel + 1
	// 				)
	// 			);
	// 			e.preventDefault();
	// 			break;
	// 		case 'ArrowUp':
	// 			highlightChannel(Math.max(0, highlightedChannel - 1));
	// 			e.preventDefault();
	// 			break;
	// 		case 'Enter':
	// 			console.log('selected channel:', channels[highlightedChannel]);
	// 			toggleChannels();
	// 			e.preventDefault();
	// 			break;
	// 		case toggleChannelsKeyCode:
	// 		case 'Escape':
	// 			toggleChannels();
	// 			e.preventDefault();
	// 			break;
	// 	}
	// }

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
		
		if (document.fullscreenElement) {
			if (e.code === toggleVideoFullScreenKeyCode) document.exitFullscreen();
			return;
		}

		// if (overlayVisible) return handleOverlayKeydownEvent(e);
		if (overviewVisible) return handleOverviewKeydownEvent(e);

		switch (e.code) {
			case 'ArrowRight':
				if (mediaIndex.get(tweetIndex) < tweets[tweetIndex].medias.length - 1) {
					mediaIndex.increment(tweetIndex);
					updateMedia(tweetIndex);
				}
				e.preventDefault();
				break;
			case 'ArrowLeft':
				if (mediaIndex.get(tweetIndex) > 0) {
					mediaIndex.decrement(tweetIndex);
					updateMedia(tweetIndex);
				}
				e.preventDefault();
				break;
			case 'ArrowDown':
				if (tweetIndex < tweets.length - 1) updateMedia(tweetIndex + 1);
				e.preventDefault();
				break;
			case 'ArrowUp':
				if (tweetIndex > 0) updateMedia(tweetIndex - 1);
				e.preventDefault();
				break;
			// case toggleChannelsKeyCode:
			// 	toggleChannels();
			// 	e.preventDefault();
			// 	break;
			case setOverviewKeyCode:
				setOverview(true);
				e.preventDefault();
				break;
			case toggleVideoFullScreenKeyCode:
				mediaElement.requestFullscreen();
				e.preventDefault();
				break;
		}
	}

	function newVideoMediaElement(autoplay) {
		const r = document.createElement('video');
		r.controls = r.loop = true;
		r.autoplay = autoplay;
		return r;
	}

	function setupMediaElement(media) {
		mediaElement?.remove();
		
		if (media.type === 'photo') {
			mediaElement = document.createElement('img');
			mediaElement.src = media.src;
		} else {
			mediaElement = newVideoMediaElement(true);
			mediaElement.src = media.src;
			mediaElement.currentTime = media.currentTime;
			mediaElement.style.width = media.width;
			mediaElement.style.height = media.height;
		}

		mediaElement.setAttribute('tabindex', '0');

		mediaElement.style.maxWidth = '100%';
		mediaElement.style.maxHeight = '100%';
		mediaElement.style.objectFit = 'contain';
		mediaElement.style.border = '0';

		mediaElement.addEventListener('keydown', handleKeydownEvent);

		mediaElement.focus();
	}

	function setupMediaContainer() {
		const mediaContainer = document.createElement('div');

		mediaContainer.id = 'media-container';
		mediaContainer.style.position = 'relative';
		mediaContainer.style.overflow = 'hidden';
		mediaContainer.style.zIndex = '0';
	
		return mediaContainer;
	}

	function setupOverviewGrid(root) {
		overviewGrid = document.createElement('div');

		overviewGrid.setAttribute('tabindex', '0');
		overviewGrid.style.objectFit = 'contain';
		overviewGrid.style.display = 'none';
		overviewGrid.style.gridTemplateColumns = `repeat(${overviewGridWidth}, 1fr)`;
		overviewGrid.style.gridTemplateRows = `repeat(${overviewGridHeight}, 1fr)`;
		overviewGrid.style.gridGap = '2px';

		for (let i = 0; i < overviewGridSize; i++) {
			const container = document.createElement('div');

			container.style.display = 'contents';
			container.style.position = 'relative';
			container.style.display = 'inline-block';

			overviewGrid.appendChild(container);
		}
	}

	function setupNavigationSystem() {
		const [reactRootWidth, reactRootHeight] = getReactRootDims();
		
		const mediaContainer = setupMediaContainer();
		mediaContainer.style.width = `${reactRootWidth}px`;
		mediaContainer.style.maxWidth = `${reactRootWidth}px`;
		mediaContainer.style.height = `${reactRootHeight}px`;
		mediaContainer.style.maxHeight = `${reactRootHeight}px`;

		const media = currentMedia(tweetIndex);
		if (media) {
			setupMediaElement(media);
			mediaContainer.appendChild(mediaElement);
		}

		setupOverviewGrid();
		overviewGrid.style.maxWidth = `${reactRootWidth}px`;
		overviewGrid.style.width = `${reactRootWidth}px`;
		overviewGrid.style.height = `${reactRootHeight}px`;
		overviewGrid.style.maxHeight = `${reactRootHeight}px`;
		mediaContainer.appendChild(overviewGrid);

		// overlay = document.createElement('div');
		// overlay.classList.add('overlay');
		// overlay.style.position = 'fixed';
		// overlay.style.top = '0';
		// overlay.style.left = '0';
		// overlay.style.right = '0';
		// overlay.style.bottom = '0';
		// overlay.style.display = 'none';
		// overlay.style.zIndex = '9999';
		// document.body.appendChild(overlay);

		// channels.forEach(name => {
		// 	const channelElement = document.createElement('div');
		// 	channelElement.classList.add('channel');
		// 	channelElement.textContent = name;
		// 	overlay.appendChild(channelElement);
		// });

		return mediaContainer;
	}

	init();

	window.twitterInit ??= true;

});