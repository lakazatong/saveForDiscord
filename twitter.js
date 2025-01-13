'use strict';

window.addEventListener('commonLoaded', () => {

	if (window?.twitterInit === true) return;

	let tweetsCount;
	const seenTweets = new Set();
	const tweets = [];
	const newTweetsSubscribers = new Map();

	let insertMediaSection = new window.DeferredFunction();
	let requestMoreTweets = new window.DeferredFunction();
	const pending = {
		_promise: trackPromise(Promise.resolve()),
		get promise() {
			return this._promise;
		},
		set promise(newPromise) {
			this._promise = trackPromise(newPromise);
		}
	};

	let mediaContainer;
	let mediaElement;
	let imgElement;
	let videoElement;
	const mediaIndex = {
		increment(index, callback) {
			if (tweets[index].cur < tweets[index].medias.length - 1) {
				callback?.();
				tweets[index].cur++;
				return true;
			}
			return false;
		},
		decrement(index, callback) {
			if (tweets[index].cur > 0) {
				callback?.();
				tweets[index].cur--;
				return true;
			}
			return false;
		}
	};

	let overviewGrid;
	const overviewGridColumns = 8;
	const overviewGridRows = 4;
	const overviewGridGap = 2; // in px
	const overviewGridSize = overviewGridColumns * overviewGridRows;
	let overviewBatchIndex = 0;
	let overviewContainer;
	let overviewVisible = false;

	let offset;

	// let overlay;
	// let overlayVisible = false;
	// let highlightedChannel = 0;
	// const channels = ['Channel 1', 'Channel 2', 'Channel 3', 'Channel 4'];

	const toggleChannelsKeyCode = 'KeyC';
	const setOverviewKeyCode = 'KeyV';
	const toggleVideoFullScreenKeyCode = 'KeyF';

	function ensureEnoughTweets(index) {
		if (tweets.length === tweetsCount) return;

		const batchIndex = Math.floor((index + overviewGridColumns) / overviewGridSize);
		const requiredTweets = (batchIndex + 1) * overviewGridSize;

		if (tweets.length < requiredTweets) {
			// const now = Date.now();
			// offset ??= now;
			// console.log('requestMoreTweets called', now - offset);
			requestMoreTweets.call();
		}
	}

	function getReactRootDims() {
		const reactRoot = document.getElementById('react-root');
		return [reactRoot.offsetWidth - 1, reactRoot.offsetHeight - 1];
	}

	function updateCSS() {
		const reactRoot = document.getElementById('react-root');
		if (!reactRoot) return;
		const w = reactRoot.offsetWidth;
		const h = reactRoot.offsetHeight;
		reactRoot.style.setProperty('--react-root-width', `${w}px`);
		reactRoot.style.setProperty('--react-root-height', `${h}px`);
		reactRoot.style.setProperty('--overview-grid-columns', `${overviewGridColumns}`);
		reactRoot.style.setProperty('--overview-grid-rows', `${overviewGridRows}`);
		reactRoot.style.setProperty('--overview-grid-gap', `${overviewGridGap}`);
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

	function getTweetMedias(newTweet) {
		// some don't have a media entity apparently
		return newTweet.legacy.entities.media?.map(media => {
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

	function currentMedia(index) {
		const tweet = tweets?.[index];
		if (!tweet) return;
		return tweet.medias[tweet.cur];
	}

	function whenReady(e, callback) {
		if (e.tagName === 'IMG') {
			if (e.complete && e.naturalHeight !== 0) {
				callback(e);
			} else {
				e.addEventListener('load', () => callback(e), { once: true });
			}
		} else if (e.tagName === 'VIDEO') {
			if (e.readyState >= 3) {
				callback(e);
			} else {
				e.addEventListener('canplaythrough', () => callback(e), { once: true });
			}
		} else {
			callback(e);
		}

	}

	function setupView(e) {
		whenReady(e, e => {
			e.addEventListener('keydown', handleKeydownEvent);
			e.scrollIntoView({
				behavior: 'auto',
				block: 'start',
				inline: 'start'
			});
			e.focus();
		});
	}

	async function updateMediaElement() {
		return new Promise(resolve => {
			const media = currentMedia(tweetIndex.value);
			if (!media) return;

			if (media.type === 'photo') {
				imgElement.style.removeProperty('visibility');
				imgElement.src = media.src;
				imgElement.style.zIndex = 2;
				videoElement.style.zIndex = 1;
				whenReady(imgElement, () => {
					videoElement.style.visibility = 'hidden';
					setupView(imgElement);
					resolve();
				});
				mediaElement = imgElement;
			} else {
				videoElement.style.removeProperty('visibility');
				videoElement.src = media.src;
				videoElement.currentTime = media.currentTime;
				videoElement.style.zIndex = 2;
				imgElement.style.zIndex = 1;
				whenReady(videoElement, () => {
					imgElement.style.visibility = 'hidden';
					setupView(videoElement);
					resolve();
				});
				mediaElement = videoElement;
			}

			ensureEnoughTweets(tweetIndex.value);
		});
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

	function activateOverview(index) {
		beforeMediaChange(mediaElement, index);
		mediaElement.style.display = 'none';
		overviewGrid.style.display = 'grid';

		overviewTweetIndex.value = index;
		overviewTweetIndex.batchIndex = getBatchIndex(index);
		pending.promise = renderOverview();

		overviewVisible = true;
	}

	function desactivateOverview(index) {
		beforeMediaChange(overviewContainer.querySelector('video'), overviewTweetIndex.value);
		overviewGrid.style.display = 'none';
		mediaElement.style.removeProperty('display');

		tweetIndex.value = index;
		pending.promise = updateMediaElement();

		overviewVisible = false;
	}

	function desactivateOverviewTweet(index) {
		const container = getOverviewContainer(index);
		container.classList.remove('overview-highlighted');
		let elm = container.querySelector('video');
		if (elm) {
			addPlayIcon(container);
		} else {
			elm = container.querySelector('img');
		}
		elm.style.transform = '';
		const span = container.querySelector('span');
		if (span) span.style.transform = '';
	}

	function activateOverviewTweet(index) {
		const container = getOverviewContainer(index);
		overviewContainer = container;
		container.classList.add('overview-highlighted');
		const elm = container.querySelector('video');
		if (elm) {
			container.querySelector('svg')?.remove();
			elm.currentTime = currentMedia(index).currentTime;
			elm.play();
			// adjustHighlightedPosition(container, elm);
		} else {
			// adjustHighlightedPosition(container, container.querySelector('img'));
		}
		setupView(overviewGrid);
	}

	function getOverviewContainer(index) {
		return overviewGrid.children[index % overviewGridSize];
	}

	function getBatchIndex(index) {
		return Math.floor(index / overviewGridSize);
	}

	const tweetIndex = {
		value: 0,
		set(newIndex) {
			if (newIndex === this.value) return;
			const oldIndex = this.value;
			this.value = newIndex;
			beforeMediaChange(mediaElement, oldIndex);
			pending.promise = updateMediaElement();
		},
		left() {
			if (mediaIndex.decrement(this.value, () => beforeMediaChange(mediaElement, this.value))) pending.promise = updateMediaElement();
		},
		right() {
			if (mediaIndex.increment(this.value, () => beforeMediaChange(mediaElement, this.value))) pending.promise = updateMediaElement();
		},
		up() {
			if (this.value > 0) this.set(this.value - 1);
		},
		down() {
			if (this.value < tweets.length - 1) this.set(this.value + 1);
		}
	};

	const overviewTweetIndex = {
		value: 0,
		batchIndex: 0,
		set(newIndex) {
			if (newIndex === this.value) return;
			const oldIndex = this.value;
			this.value = newIndex;

			const newBatchIndex = getBatchIndex(this.value);

			beforeMediaChange(getOverviewContainer(oldIndex).querySelector('video'), oldIndex);

			if (newBatchIndex !== this.batchIndex) {
				this.batchIndex = newBatchIndex;
				pending.promise = renderOverview();
			} else {
				desactivateOverviewTweet(oldIndex);
				activateOverviewTweet(this.value);
			}

			ensureEnoughTweets(this.value);
		},
		left() {
			this.set(this.value === 0 ? tweets.length - 1 : this.value - 1);
		},
		right() {
			this.set(this.value === tweets.length - 1 ? 0 : this.value + 1);
		},
		up() {
			if (this.value < overviewGridColumns) {
				let newIndex = tweets.length - 1;
				const left = newIndex % overviewGridColumns;
				this.set(newIndex - Math.max(0, left - this.value));
			} else {
				this.set(this.value - overviewGridColumns);
			}
		},
		down() {
			const overflow = tweets.length % overviewGridColumns;
			if (this.value >= (tweets.length - (overflow ? overflow : overviewGridColumns))) {
				this.set(this.value % overviewGridColumns);
			} else {
				this.set(Math.min(this.value + overviewGridColumns, tweets.length - 1));
			}
		}
	};

	function addPlayIcon(container) {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 20 20');
		svg.classList.add('overview-video-play-icon');
		svg.innerHTML = `<polygon points="6,4 16,10 6,16" />`;
		container.appendChild(svg);
		return svg;
	}

	function addCounter(container) {
		const counter = document.createElement('span');
		counter.classList.add('overview-media-counter');
		container.appendChild(counter);
		return counter;
	}

	function setupOverviewMediaElement(index) {
		const container = getOverviewContainer(index);
		const isSelected = index === overviewTweetIndex.value;
		if (isSelected) overviewContainer = container;
		const tweet = tweets[index];
		const medias = tweet.medias;
		const media = medias[tweet.cur];

		const oldChildren = [...Array.from(container.children)];

		let e;
		if (media.type === 'photo') {
			e = document.createElement('img');
			e.src = media.src;
		} else {
			e = newVideoMediaElement(false, false);
			e.src = media.src;
			e.currentTime = media.currentTime;
			if (isSelected) {
				e.play();
			} else {
				addPlayIcon(container);
			}
		}

		const elm = e;
		elm.classList.add('overview-grid-media');
		
		return new Promise(resolve => whenReady(elm, () => {
			container.appendChild(elm);
			if (medias.length > 1) addCounter(container).textContent = `${tweet.cur + 1}/${medias.length}`;
			oldChildren.forEach(child => child.remove());
			if (isSelected) {
				container.classList.add('overview-highlighted');
				// adjustHighlightedPosition(container, elm);
			} else {
				container.classList.remove('overview-highlighted');
			}
			resolve();
		}));
	}

	async function renderOverview() {
		const promises = [];
		const start = overviewTweetIndex.batchIndex * overviewGridSize;
		const end = Math.min(start + overviewGridSize, tweetsCount);
		let i = start;
		for (; i < end; i++) {
			const index = i;
			const localIndex = index % overviewGridSize;
			if (newTweetsSubscribers.get(localIndex)) newTweetsSubscribers.delete(localIndex);
			const container = overviewGrid.children[localIndex];
			promises.push(tweets?.[index]
				? setupOverviewMediaElement(index)
				: new Promise(resolve => newTweetsSubscribers.set(localIndex, async function (newTweet) {
					if (tweets?.[index]) {
						newTweetsSubscribers.delete(localIndex);
						await setupOverviewMediaElement(index);
						resolve();
					}
				}))
			);
		}
		i %= overviewGridSize;
		if (i > 0) {
			while (i < overviewGridSize) {
				const container = overviewGrid.children[i++];
				container.innerHTML = '';
				container.classList.remove('overview-highlighted');
			}
		}
		// const firstOverviewContainer = overviewGrid.children[0];
		setupView(overviewGrid);
		return Promise.all(promises);
	}

	// function highlightChannel(index) {
	// 	document.querySelectorAll('.channel').forEach((channel, i) => {
	// 		channel.classList.toggle('highlighted', i === index);
	// 	});
	// 	highlightedChannel = index;
	// }

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

	function beforeMediaChange(elm, index) {
		if (elm?.currentTime >= 0) {
			const tweet = tweets[index];
			tweet.medias[tweet.cur].currentTime = elm.currentTime;
			elm.pause();
		}
	}

	function adjustHighlightedPosition(container, mediaElm) {
		const rect = container.getBoundingClientRect();
		const w = mediaElm.naturalWidth;
		const h = mediaElm.naturalHeight;

		let newWidth = rect.width;
		let newHeight = rect.height;

		let leftOffset = 0;
		let topOffset = 0;

		if (w / h > rect.width / rect.height) {
			newWidth = w / h * newHeight;
			if (window.innerWidth < newWidth) {
				newWidth = window.innerWidth;
				newHeight = newWidth * (h / w);
			}
			const left = rect.left - (newWidth - rect.width) / 2;
			if (left < 0) {
				leftOffset = left;
			} else {
				const right = left + newWidth;
				if (right > window.innerWidth) leftOffset = right - window.innerWidth;
			}
		} else if (h / w > rect.height / rect.width) {
			newHeight = h / w * newWidth;
			if (window.innerHeight < newHeight) {
				newHeight = window.innerHeight;
				newWidth = newHeight * (w / h);
			}
			const top = rect.top - (newHeight - rect.height) / 2;
			if (top < 0) {
				topOffset = top;
			} else {
				const bottom = top + newHeight;
				if (bottom > window.innerHeight) topOffset = bottom - window.innerHeight;
			}
		}

		mediaElm.style.width = `${newWidth}px`;
		mediaElm.style.width = `${newHeight}px`;
		mediaElm.style.transform = updateCSSProperty(getComputedStyle(mediaElm).transform, 'translate', `${-leftOffset}px, ${-topOffset}px`);
	}

	function handleOverviewKeydownEvent(e) {
		// console.log(e.code);

		const index = overviewTweetIndex.value;

		const help = () => beforeMediaChange(overviewContainer.querySelector('video'), index);

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
					if (mediaIndex.increment(index, help)) pending.promise = setupOverviewMediaElement(overviewTweetIndex.value, true);
				} else {
					overviewTweetIndex.right();
				}
				e.preventDefault();
				break;
			case 'ArrowLeft':
				if (e.shiftKey) {
					if (mediaIndex.decrement(index, help)) pending.promise = setupOverviewMediaElement(overviewTweetIndex.value, true);
				} else {
					overviewTweetIndex.left();
				}
				e.preventDefault();
				break;
			case 'Enter':
				desactivateOverview(index);
				e.preventDefault();
				break;
			case setOverviewKeyCode:
			case 'Escape':
				desactivateOverview(tweetIndex.value);
				e.preventDefault();
				break;
		}
	}

	async function handleKeydownEvent(e) {
		// drop if some media is loading
		if (pending.promise.getState() === 'pending') {
			e.preventDefault();
			return;
		}

		// console.log(e.code);

		if (document.fullscreenElement) {
			if (e.code === toggleVideoFullScreenKeyCode) {
				document.exitFullscreen();
				document.addEventListener('fullscreenchange', () => setupView(mediaElement), { once: true });
			}
			return;
		}

		if (overviewVisible) return handleOverviewKeydownEvent(e);
		// if (overlayVisible) return handleOverlayKeydownEvent(e);

		switch (e.code) {
			case 'ArrowRight':
				if (!e.shiftKey) {
					tweetIndex.right();
					e.preventDefault();
				}
				break;
			case 'ArrowLeft':
				if (!e.shiftKey) {
					tweetIndex.left();
					e.preventDefault();
				}
				break;
			case 'ArrowDown':
				tweetIndex.down();
				e.preventDefault();
				break;
			case 'ArrowUp':
				tweetIndex.up();
				e.preventDefault();
				break;
			// case toggleChannelsKeyCode:
			// 	toggleChannels();
			// 	e.preventDefault();
			// 	break;
			case setOverviewKeyCode:
				activateOverview(tweetIndex.value);
				e.preventDefault();
				break;
			case toggleVideoFullScreenKeyCode:
				mediaContainer.requestFullscreen();
				e.preventDefault();
				break;
			case 'Space':
				e.preventDefault();
				break;
		}
	}

	function newVideoMediaElement(controls, autoplay) {
		const r = document.createElement('video');
		r.loop = true;
		r.controls = controls;
		r.autoplay = autoplay;
		return r;
	}

	function setupMediaElement() {
		imgElement = document.createElement('img');
		imgElement.id = 'img-element';
		imgElement.setAttribute('tabindex', '0');
		
		videoElement = newVideoMediaElement(true, true);
		videoElement.id = 'video-element';
		videoElement.setAttribute('tabindex', '0');

		mediaContainer.appendChild(imgElement);
		mediaContainer.appendChild(videoElement);
		
		pending.promise = updateMediaElement();
	}

	function setupOverviewGrid(root) {
		overviewGrid = document.createElement('div');
		overviewGrid.setAttribute('tabindex', '0');
		overviewGrid.id = 'overview-grid';
		overviewGrid.style.display = 'none';
		for (let i = 0; i < overviewGridSize; i++) {
			const container = document.createElement('div');
			container.classList.add('overview-grid-container');
			overviewGrid.appendChild(container);
		}
		mediaContainer.appendChild(overviewGrid);
	}

	function setupNavigationSystem() {
		updateCSS();

		mediaContainer = document.createElement('div');
		mediaContainer.id = 'media-container';
		mediaContainer.classList.add('ignore');

		setupMediaElement();

		setupOverviewGrid();

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

	// Injection logic

	console.log('twitter');
	window.documentReady = getDocumentReady.bind(document);

	let bodyRef;
	function init() {
		if (document.querySelector(`*[id="${window.uuid}"]`)) return;

		const marker = document.createElement('div');
		marker.id = window.uuid;
		document.body.appendChild(marker);

		window.addEventListener('resize', updateCSS);
		new ResizeObserver(updateCSS).observe(document.getElementById('react-root'));

		window.addEventListener('message', function (event) {
			if (event.data?.action !== 'UserMediaResponse' || !document.location.href.endsWith('media')) return;

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
				const medias = getTweetMedias(newTeet);
				if (!medias) return;
				const tweet = { createdAt: getTweetCreatedAt(newTeet), medias, cur: 0 };
				insort(tweets, tweet, media => -media.createdAt);
				newTweetsSubscribers.forEach(callback => callback(newTeet));
			});
			
			const percentage = Math.round(tweets.length / tweetsCount * 100, 2);
			console.log(`got ${tweets.length}/${tweetsCount} media tweets (${percentage}%)`);
			insertMediaSection.call();
		});

		function timelineCallback(timeline) {
			const seenUUID = generateUUID();
			const startTimelineAttributeObserver = getStartAttributeObserver(timeline);

			// modify timeline's tweets
			function modifyTweets() {
				// console.log('modifyTweets called');
				startTimelineAttributeObserver('article', 'data-testid', 'tweet', tweet => {
					getNthChild(tweet, [0, 0, 1], tweetTopDiv => {
						// delete tweets with no img
						getNthChild(tweetTopDiv, 1, tweetDiv => {
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
						getNthChild(tweetTopDiv, 0, softRemove);
					});

					tweet.style.padding = '0px';

					// where pinned is (for each tweet)
					getNthChild(tweet, [0, 0, 0], softRemove);

					tweet.setAttribute('data-testid', seenUUID);

					setTimeout(modifyTweets, 0);
				});
			}

			modifyTweets();

			if (document.location.href.endsWith('media')) {
				requestMoreTweets.define(function () {
					// const now = Date.now();
					// offset ??= now;
					// console.log('requestMoreTweets called fr', now - offset);
					Array.from(timeline.children).forEach(softRemove);
				});

				function watchNewTweetsRows() {
					// console.log('watchNewTweetsRows called');
					startTimelineAttributeObserver('div', 'data-testid', 'cellInnerDiv', tweetRow => {
						ensureEnoughTweets(Math.max(tweetIndex.value, overviewTweetIndex.value));

						tweetRow.setAttribute('data-testid', seenUUID);

						setTimeout(watchNewTweetsRows, 0);
					});
				}

				watchNewTweetsRows();
			}
		}

		function actualPrimaryColumnCallback(actualPrimaryColumn) {
			getPNthChild(actualPrimaryColumn, 0, topActualPrimaryColumn => {
				// profile banner
				getPNthChild(topActualPrimaryColumn, 0, null, softRemove);
				getPNthChild(topActualPrimaryColumn, 1, null, presentation => {
					presentation.style.margin = presentation.style.padding = '0px';
				});
			});
			// profile pp
			getPNthChild(actualPrimaryColumn, [0, 1, 0], null, softRemove);
			function sectionCallback(section) {
				getPNthChild(section, [1, 0], timelineCallback);
				if (document.location.href.endsWith('media')) {
					insertMediaSection.define(function () {
						if (!actualPrimaryColumn.querySelector('div[id="media-container"]'))
							actualPrimaryColumn.insertBefore(setupNavigationSystem(), section);
					});
				}
			}
			const getStartActualPrimaryColumnAttributePObserver = getStartAttributePObserver(actualPrimaryColumn);
			getStartActualPrimaryColumnAttributePObserver('nav', 'role', 'navigation', null, navbar => {
				if (document.location.href.endsWith('media')) {
					navbar.style.zIndex = '0';
				}
			});
			getStartActualPrimaryColumnAttributePObserver('section', 'role', 'region', sectionCallback, section => {
				if (document.location.href.endsWith('media')) {
					section.style.visibility = 'hidden';
				}
			});
		}

		function homeTimelineCallback(homeTimeline) {
			// sticky top back and follow button with tweeter profile's name and posts count
			// getPNthChild(homeTimeline, 0, null, softRemove);
			getPNthChild(homeTimeline, [2, 0, 0], actualPrimaryColumnCallback, actualPrimaryColumn => {
				// actualPrimaryColumn.style.width = actualPrimaryColumn.style.maxWidth = `${getReactRootDims()[0]}px`;
				
					
				makeTargetRoot(actualPrimaryColumn);
				actualPrimaryColumn.style.display = 'flex';
				actualPrimaryColumn.style.flexDirection = 'column';
				actualPrimaryColumn.style.height = '100%';
				actualPrimaryColumn.style.width = '100%';
				actualPrimaryColumn.style.overflow = 'hidden';
			});
		}

		function primaryColumnCallback(primaryColumn) {
			getPNthChild(primaryColumn, 0, homeTimelineCallback);
		}

		const startBodyAttributePObserver = getStartAttributePObserver(document.body);
		// left side column
		// startBodyAttributePObserver('header', 'role', 'banner', null, softRemove);
		// right side column
		// startBodyAttributePObserver('div', 'data-testid', 'sidebarColumn', null, softRemove);
		// self explainatory
		// startBodyAttributePObserver('div', 'data-testid', 'DMDrawer', null, softRemove);
		// startBodyAttributePObserver('div', 'data-testid', 'primaryColumn', primaryColumnCallback, primaryColumn => {
			// primaryColumn.style.border = '0px';
		// });
		function hideAllBut(targetElement) {
			const allElements = document.body.getElementsByTagName('*');
			for (let element of allElements) {
				if (!targetElement.contains(element) && element !== targetElement) element.style.display = 'none';
			}
		}
		function ignoreStyles(e) {
			// console.log('ignoreStyles called on ', e);
			e.style.display = 'contents';
			e.style.position = 'absolute';
			e.style.top = '0';
			e.style.left = '0';
			e.style.width = '0';
			e.style.height = '0';
			e.style.margin = '0';
			e.style.padding = '0';
			e.style.border = 'none';
			e.style.visibility = 'visible';
			e.style.pointerEvents = 'none';
		}
		function rootStyles(e) {
			e.style.position = 'absolute';
			e.style.display = 'flex';
			e.style.flexDirection = 'column';
			e.style.height = '100vh';
			e.style.width = '100vw';
			e.style.overflow = 'hidden';
		}
		// startBodyAttributePObserver('div', 'id', 'react-root', reactRoot => {
		// 	console.log('1 called');
		// 	getPNthChild(reactRoot, [0, 0, 2], mainParent => {
		// 		console.log('2 called');
		// 		getStartAttributePObserver(mainParent)('main', 'role', 'main', mainElm => {
		// 			console.log('3 called');
		// 			getPNthChild(mainElm, [0, 0, 0, 0, 0, 2, 0, 0], primaryColumn => {
		// 				console.log('4 called');
		// 				hideAllBut(primaryColumn);
		// 			}, rootStyles, ignoreStyles);
		// 		}, ignoreStyles);
		// 	}, ignoreStyles, ignoreStyles);
		// }, ignoreStyles);

		getStartAttributePObserver(document.body)('div', 'id', 'react-root', reactRoot => {
			console.log('new reactRoot', reactRoot);
			getPNthChild(reactRoot, [0, 0, 2], mainParent => {
				console.log('new mainParent', mainParent);
			}, mainParent => {
				console.log('attributes of mainParent changed');
			}, intermediate => {
				console.log('new intermediate', intermediate);
			}, intermediate => {
				console.log('attributes of intermediate changed', intermediate);
			});
		});
		// startObserver(document.body,
		// 	document.body.querySelector('div[id="react-root"]'),
		// 	e => e.tagName === 'DIV' && e.id === 'react-root',
		// 	reactRoot => {
		// 		console.log('got new reactRoot', reactRoot);
		// 	},
		// 	reactRoot => {
		// 		console.log('styles of reactRoot changed', reactRoot);
		// 	}
		// );
	}

	init();

	window.twitterInit ??= true;

});