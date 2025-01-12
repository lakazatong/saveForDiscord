'use strict';

function detectCropping(img) {
	const container = img.parentElement;
	const rect = container.getBoundingClientRect();
	const naturalWidth = img.naturalWidth;
	const naturalHeight = img.naturalHeight;

	let newWidth = rect.width;
	let newHeight = rect.height;

	let leftOffset = 0;
	let topOffset = 0;

	if (naturalWidth / naturalHeight > rect.width / rect.height) {
		newWidth = naturalWidth / naturalHeight * newHeight;
		if (window.innerWidth < newWidth) {
			newWidth = window.innerWidth;
			newHeight = newWidth * (naturalHeight / naturalWidth);
		}
		const left = rect.left - (newWidth - rect.width) / 2;
		if (left < 0) {
			leftOffset = left;
		} else {
			const right = left + newWidth;
			if (right > window.innerWidth) leftOffset = right - window.innerWidth;
		}
	} else if (naturalHeight / naturalWidth > rect.height / rect.width) {
		newHeight = naturalHeight / naturalWidth * newWidth;
		if (window.innerHeight < newHeight) {
			newHeight = window.innerHeight;
			newWidth = newHeight * (naturalWidth / naturalHeight);
		}
		const top = rect.top - (newHeight - rect.height) / 2;
		if (top < 0) {
			topOffset = top;
		} else {
			const bottom = top + newHeight;
			if (bottom > window.innerHeight) topOffset = bottom - window.innerHeight;
		}
	}

	return [newWidth, newHeight, leftOffset, topOffset];
}

document.addEventListener('DOMContentLoaded', () => {
	const mediaItems = document.querySelectorAll('.overview-grid-container');
	mediaItems.forEach(item => {
		const img = item.querySelector('.overview-grid-media');
		item.addEventListener('mouseenter', () => {
			const [imgWidth, imgHeight, leftOffset, topOffset] = detectCropping(img);
			img.style.width = `${imgWidth}px`;
			img.style.height = `${imgHeight}px`;
			img.style.transform = `translate(${-leftOffset}px, ${-topOffset}px)`;
		});
		item.addEventListener('mouseleave', () => {
			img.style.transform = '';
		});
	});
});