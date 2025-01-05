'use strict';

window.addEventListener('commonLoaded', () => {

	if (window?.twitterInit === true) return;

	// Injection logic

	console.log('twitter');
	window.documentReady = getDocumentReady.bind(document);

	const images = new Map();

	function init() {
		if (document.querySelector(`*[id="${window.uuid}"]`)) return;

		const marker = document.createElement('div');
		marker.id = window.uuid;
		document.body.appendChild(marker);

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
							setupNavigationSystem(actualPrimaryColumn); // TODO: SET (not ADD) the navigation system
						}

						// modify timeline's tweets
						
						observeNthChild(actualPrimaryColumn, [2, 1, 0], timeLine => {
							timeLine.querySelectorAll('li[role="listitem"]').forEach(liElement => {
								const link = liElement.querySelector('a[role="link"]');
								if (!link) return;
								const href = link.getAttribute('href');
								if (!href) return;
								const hasMultipleImages = link.childElementCount > 1; // has the svg icon indicating it
								if (!images.has(href)) {
									images.set(href, { liElement, hasMultipleImages });
									startObserver(liElement, () => liElement.querySelector('img'), e => e.tagName === 'IMG', e => createImageElement(e.getAttribute('src'), hasMultipleImages)); // TODO: build the new image element here for the navigation system up top
								}
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

	let isNavSysSetup = false;
	function setupNavigationSystem(column) {
		if (isNavSysSetup) return;
		// Example: Create a navigation bar or system
		const navBar = document.createElement('div');
		navBar.style.position = 'fixed';
		navBar.style.top = '0';
		navBar.style.width = '100%';
		navBar.style.backgroundColor = '#fff';
		navBar.style.zIndex = '999';
		navBar.innerHTML = `
			<button onclick="scrollToSection('top')">Top</button>
			<button onclick="scrollToSection('media')">Media</button>
		`;
		column.prepend(navBar);

		function scrollToSection(section) {
			if (section === 'top') {
				window.scrollTo({ top: 0, behavior: 'smooth' });
			} else if (section === 'media') {
				document.querySelector(`[data-section="${section}"]`)?.scrollIntoView({ behavior: 'smooth' });
			}
		}
		isNavSysSetup = true;
	}

	function stripUrlAndAppendFormat(url) {
		const urlObj = new URL(url);
		const baseUrl = urlObj.origin + urlObj.pathname;
		const format = urlObj.searchParams.get('format') || 'png';
		return `${baseUrl}.${format}`;
	}

	const imgSrcs = new Set();
	function createImageElement(href, hasMultipleImages) {
		
		const imgSrc = stripUrlAndAppendFormat(href);
		if (imgSrcs.has(imgSrc)) return;
		imgSrcs.add(imgSrc);

		const imgWrapper = document.createElement('div');
		imgWrapper.className = 'custom-image-wrapper';
		imgWrapper.style.border = '1px solid #ccc';
		imgWrapper.style.margin = '10px';

		const imgElement = document.createElement('img');
		imgElement.src = imgSrc;
		imgElement.alt = 'Tweet Image';
		imgElement.style.width = '100%';
		imgElement.style.height = 'auto';

		if (hasMultipleImages) {
			const badge = document.createElement('div');
			badge.innerText = 'Multiple Images';
			badge.style.position = 'absolute';
			badge.style.top = '5px';
			badge.style.right = '5px';
			badge.style.backgroundColor = '#ff0000';
			badge.style.color = '#fff';
			badge.style.padding = '2px 5px';
			badge.style.borderRadius = '3px';
			imgWrapper.appendChild(badge);
		}

		imgWrapper.appendChild(imgElement);
		document.body.appendChild(imgWrapper);
	}
	
	init();

	window.twitterInit ??= true;

});