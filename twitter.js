'use strict';

window.addEventListener('commonLoaded', () => {

	if (window?.twitterInit === true) return;

	let tweetsCount;
	const seenTweets = new Set();
	const tweets = [];
	const newTweetsSubscribers = new Map();

	let insertMediaSection = new DeferredFunction();
	let requestMoreTweets = new DeferredFunction();

	let mediaContainer;
	let mediaElement;
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
		const w = reactRoot.offsetWidth - 1;
		const h = reactRoot.offsetHeight - 1;
		reactRoot.style.setProperty('--react-root-width', `${w}px`);
		reactRoot.style.setProperty('--react-root-height', `${h}px`);
		reactRoot.style.setProperty('--overview-grid-columns', `${overviewGridColumns}`);
		reactRoot.style.setProperty('--overview-grid-rows', `${overviewGridRows}`);
		reactRoot.style.setProperty('--overview-grid-media-width', `${Math.floor(w / overviewGridColumns)}px`);
		reactRoot.style.setProperty('--overview-grid-media-height', `${Math.floor(h / overviewGridRows)}px`);
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

	function updateMedia() {
		const media = currentMedia(tweetIndex.value);
		if (!media) return;

		ensureEnoughTweets(tweetIndex.value);

		if (media.type === mediaElementType()) {
			mediaElement.src = media.src;
			if (mediaElement.currentTime >= 0) mediaElement.currentTime = media.currentTime;
			mediaElement.play?.();
			mediaElement.focus();
			mediaContainer.scrollIntoView({
				behavior: 'auto',
				block: 'start',
				inline: 'start'
			});
			return true;
		} else {
			setupMediaElement(media);
			return false;
		}
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
		renderOverview();
		overviewGrid.addEventListener('keydown', handleKeydownEvent);

		overviewGrid.focus();
		overviewVisible = true;
	}

	function desactivateOverview(index) {
		beforeMediaChange(overviewContainer.querySelector('video'), overviewTweetIndex.value);
		overviewGrid.style.display = 'none';
		mediaElement.style.removeProperty('display');

		tweetIndex.value = index;
		if (updateMedia()) mediaElement.addEventListener('keydown', handleKeydownEvent);

		overviewVisible = false;
	}

	function activateOverviewTweet(index) {
		const container = getOverviewContainer(index);
		container.classList.add('overview-highlighted');
		const elm = container.querySelector('video');
		if (elm) {
			container.querySelector('svg').remove();
			elm.currentTime = currentMedia(index).currentTime;
			elm.play();
		}
		overviewContainer = container;
	}

	function desactivateOverviewTweet(index) {
		const container = getOverviewContainer(index);
		container.classList.remove('overview-highlighted');
		const elm = container.querySelector('video');
		if (elm) addPlayIcon(container);
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
			updateMedia();
		},
		left() {
			if (mediaIndex.decrement(this.value, () => beforeMediaChange(mediaElement, this.value))) updateMedia();
		},
		right() {
			if (mediaIndex.increment(this.value, () => beforeMediaChange(mediaElement, this.value))) updateMedia();
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
				renderOverview();
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
		if (container.querySelector('svg')) return;
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

	function setupOverviewMediaElement(index, mark = false) {
		const container = getOverviewContainer(index);
		const tweet = tweets[index];
		const medias = tweet.medias;
		const media = medias[tweet.cur];
		const uuid = mark ? generateUUID() : undefined;
		const isSelected = index === overviewTweetIndex.value;

		if (isSelected) {
			container.classList.add('overview-highlighted');
			overviewContainer = container;
		} else {
			container.classList.remove('overview-highlighted');
		}

		let elm;
		if (media.type === 'photo') {
			elm = document.createElement('img');
			elm.src = media.src;
		} else {
			elm = newVideoMediaElement();
			elm.src = media.src;

			if (isSelected) {
				elm.currentTime = media.currentTime;
				elm.play();
			} else {
				const playIcon = addPlayIcon(container);
				if (mark) playIcon.setAttribute('data-uuid', uuid);
			}
		}

		elm.classList.add('overview-grid-media');
		if (mark) elm.setAttribute('data-uuid', uuid);
		container.appendChild(elm);

		if (medias.length <= 1) return uuid;

		return new Promise((resolve) => elm.addEventListener(media.type === 'photo' ? 'load' : 'loadedmetadata',
			() => {
				const counter = addCounter(container);
				counter.textContent = `${tweet.cur + 1}/${medias.length}`;
				if (mark) counter.setAttribute('data-uuid', uuid);
				resolve(uuid);
			},
			{ once: true }
		));
	}

	function renderOverview() {
		const start = overviewTweetIndex.batchIndex * overviewGridSize;
		const end = Math.min(start + overviewGridSize, tweetsCount);
		let i = start;
		for (; i < end; i++) {
			const index = i;
			const localIndex = index % overviewGridSize;
			if (newTweetsSubscribers.get(localIndex)) newTweetsSubscribers.delete(localIndex);
			const container = overviewGrid.children[localIndex];
			container.innerHTML = '';
			if (tweets?.[index]) {
				setupOverviewMediaElement(index);
				continue;
			}
			newTweetsSubscribers.set(localIndex, function (newTweet) {
				if (tweets?.[index]) {
					newTweetsSubscribers.delete(localIndex);
					setupOverviewMediaElement(index);
				}
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
		mediaContainer.scrollIntoView({
			behavior: 'auto',
			block: 'start',
			inline: 'start'
		});
	}

	let updateOverviewMediaPromise;
	async function updateOverviewMedia() {
		await updateOverviewMediaPromise;
		// if (!tweets?.[overviewTweetIndex.value]) return;
		const uuid = await setupOverviewMediaElement(overviewTweetIndex.value, true);

		Array.from(overviewContainer.querySelectorAll(`:scope > *`)).forEach((child) => {
			if (child.getAttribute('data-uuid') === uuid) {
				child.removeAttribute('data-uuid');
			} else {
				overviewContainer.removeChild(child);
			}
		});
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
		if (elm) {
			saveCurrentTime(elm, index);
			elm.pause?.();
		}
	}

	function handleOverviewKeydownEvent(e) {
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
					if (mediaIndex.increment(index, help)) updateOverviewMediaPromise = updateOverviewMedia();
				} else {
					overviewTweetIndex.right();
				}
				e.preventDefault();
				break;
			case 'ArrowLeft':
				if (e.shiftKey) {
					if (mediaIndex.decrement(index, help)) updateOverviewMediaPromise = updateOverviewMedia();
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
		// console.log(e.code);

		if (document.fullscreenElement) {
			if (e.code === toggleVideoFullScreenKeyCode) document.exitFullscreen();
			return;
		}

		// if (overlayVisible) return handleOverlayKeydownEvent(e);
		if (overviewVisible) return handleOverviewKeydownEvent(e);

		switch (e.code) {
			case 'ArrowRight':
				tweetIndex.right();
				e.preventDefault();
				break;
			case 'ArrowLeft':
				tweetIndex.left();
				e.preventDefault();
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
				mediaElement.requestFullscreen();
				e.preventDefault();
				break;
		}
	}

	function newVideoMediaElement() {
		const r = document.createElement('video');
		r.controls = r.loop = true;
		return r;
	}

	function setupMediaElement(media) {
		mediaElement?.remove();
		if (media.type === 'photo') {
			mediaElement = document.createElement('img');
			mediaElement.src = media.src;
		} else {
			mediaElement = newVideoMediaElement();
			mediaElement.src = media.src;
			mediaElement.currentTime = media.currentTime;
			mediaElement.play();
		}
		mediaElement.id = 'media-element';
		mediaElement.setAttribute('tabindex', '0');
		mediaElement.addEventListener('keydown', handleKeydownEvent);
		mediaContainer.appendChild(mediaElement);
		mediaElement.focus();
		mediaContainer.scrollIntoView({
			behavior: 'auto',
			block: 'start',
			inline: 'start'
		});
	}

	function setupOverviewGrid(root) {
		overviewGrid = document.createElement('div');
		overviewGrid.id = 'overview-grid';
		overviewGrid.setAttribute('tabindex', '0');
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

		const media = currentMedia(tweetIndex.value);
		if (media) setupMediaElement(media);

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
				})
					.then(() => modifyTweets());
			}

			modifyTweets();

			if (document.location.href.endsWith('media')) {
				timeline.style.minHeight = '0';

				requestMoreTweets.define(function () {
					// const now = Date.now();
					// offset ??= now;
					// console.log('requestMoreTweets called fr', now - offset);
					Array.from(timeline.children).forEach(softRemove);
				});

				function watchNewTweetsRows() {
					startTimelineAttributeObserver('div', 'data-testid', 'cellInnerDiv', tweetRow => {
						ensureEnoughTweets(Math.max(tweetIndex.value, overviewTweetIndex.value));

						tweetRow.setAttribute('data-testid', seenUUID);
					})
						.then(() => watchNewTweetsRows());
				}

				watchNewTweetsRows();
			}
		}

		function actualPrimaryColumnCallback(actualPrimaryColumn) {
			getPNthChild(actualPrimaryColumn, 0, topActualPrimaryColumn => {
				// profile banner
				getPNthChild(topActualPrimaryColumn, 0, softRemove);
				getPNthChild(topActualPrimaryColumn, 1, presentation => {
					presentation.style.margin = presentation.style.padding = '0px';
				});
			});
			// profile pp
			getPNthChild(actualPrimaryColumn, [0, 1, 0], softRemove);
			// hacky but it works
			actualPrimaryColumn.style.width = actualPrimaryColumn.style.maxWidth = `${getReactRootDims()[0]}px`;

			function mediaSectionCallback(mediaSection) {
				mediaSection.style.position = 'relative';
				mediaSection.style.overflow = 'hidden';
				getPNthChild(mediaSection, [1, 0], timelineCallback);
				if (document.location.href.endsWith('media')) {
					insertMediaSection.define(function () {
						if (!actualPrimaryColumn.querySelector('div[id="media-container"]'))
							actualPrimaryColumn.insertBefore(setupNavigationSystem(), mediaSection);
					});
					mediaContainer?.scrollIntoView({
						behavior: 'auto',
						block: 'start',
						inline: 'start'
					});
				}
			}
			getStartAttributePObserver(actualPrimaryColumn)('section', 'role', 'region', mediaSectionCallback);
		}

		function homeTimelineCallback(homeTimeline) {
			// sticky top back and follow button with tweeter profile's name and posts count
			getPNthChild(homeTimeline, 0, softRemove);
			getPNthChild(homeTimeline, [2, 0, 0], actualPrimaryColumnCallback);
		}

		function primaryColumnCallback(primaryColumn) {
			primaryColumn.style.border = '0px';
			getPNthChild(primaryColumn, 0, homeTimelineCallback);
		}

		const startBodyAttributePObserver = getStartAttributePObserver(document.body);
		// left side column
		startBodyAttributePObserver('header', 'role', 'banner', softRemove);
		// right side column
		startBodyAttributePObserver('div', 'data-testid', 'sidebarColumn', softRemove);
		// self explainatory
		startBodyAttributePObserver('div', 'data-testid', 'DMDrawer', softRemove);
		startBodyAttributePObserver('div', 'data-testid', 'primaryColumn', primaryColumnCallback);
	}

	init();

	window.twitterInit ??= true;

});