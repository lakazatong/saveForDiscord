'use strict';

// Save logic

function replaceExtensionWithPng(filename) {
	const parts = filename.split('.');
	parts[parts.length - 1] = 'png';
	return parts.join('.');
}

function getFilenameFromUrl(url) {
	const urlParts = url.split('/');
	return replaceExtensionWithPng(urlParts[urlParts.length - 1]);
}

async function downloadImage(url, filename, compress) {
	return new Promise((resolve, reject) => {
		if (!url) {
			console.error("downloadImage failed: url = ", url);
			return reject();
		}
		let xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.responseType = 'blob';

		xhr.onload = async () => {
			console.log("image downloaded");
			await saveImageAsPng(xhr.response, filename, compress);
			resolve();
		};

		xhr.onerror = () => {
			console.error("downloadImage failed: url = ", url);
			reject();
		};

		console.log("downloading image...");
		xhr.send();
	});
}

async function saveImageAsPng(blob, filename, compress) {
	if (compress && blob.size >= 10 * 1024 * 1024) {
		saveFile(await imageConversion.compressAccurately(blob, 10 * 1024), filename);
	} else {
		saveFile(blob, filename);
	}
}

function saveFile(blob, filename) {
	try {
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	} catch (err) {
		console.error("saveFile failed:", err);
	}
}

// UUID

// Author: Abhishek Dutta, 12 June 2020
// License: CC0 (https://creativecommons.org/choose/zero/)
function generateUUID() {
	var temp_url = URL.createObjectURL(new Blob());
	var uuid = temp_url.toString();
	URL.revokeObjectURL(temp_url);
	return uuid.substr(uuid.lastIndexOf('/') + 1);
}

window.uuid ??= generateUUID();

// Image Conversion

!function (t, e) { "object" == typeof exports && "object" == typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define([], e) : "object" == typeof exports ? exports.imageConversion = e() : t.imageConversion = e() }(this, (function () { return function (t) { var e = {}; function n(r) { if (e[r]) return e[r].exports; var o = e[r] = { i: r, l: !1, exports: {} }; return t[r].call(o.exports, o, o.exports, n), o.l = !0, o.exports } return n.m = t, n.c = e, n.d = function (t, e, r) { n.o(t, e) || Object.defineProperty(t, e, { enumerable: !0, get: r }) }, n.r = function (t) { "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(t, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(t, "__esModule", { value: !0 }) }, n.t = function (t, e) { if (1 & e && (t = n(t)), 8 & e) return t; if (4 & e && "object" == typeof t && t && t.__esModule) return t; var r = Object.create(null); if (n.r(r), Object.defineProperty(r, "default", { enumerable: !0, value: t }), 2 & e && "string" != typeof t) for (var o in t) n.d(r, o, function (e) { return t[e] }.bind(null, o)); return r }, n.n = function (t) { var e = t && t.__esModule ? function () { return t.default } : function () { return t }; return n.d(e, "a", e), e }, n.o = function (t, e) { return Object.prototype.hasOwnProperty.call(t, e) }, n.p = "", n(n.s = 0) }([function (t, e, n) { "use strict"; var r; function o(t) { return ["image/png", "image/jpeg", "image/gif"].some(e => e === t) } n.r(e), n.d(e, "canvastoDataURL", (function () { return a })), n.d(e, "canvastoFile", (function () { return c })), n.d(e, "dataURLtoFile", (function () { return s })), n.d(e, "dataURLtoImage", (function () { return l })), n.d(e, "downloadFile", (function () { return d })), n.d(e, "filetoDataURL", (function () { return f })), n.d(e, "imagetoCanvas", (function () { return g })), n.d(e, "urltoBlob", (function () { return w })), n.d(e, "urltoImage", (function () { return m })), n.d(e, "compress", (function () { return p })), n.d(e, "compressAccurately", (function () { return b })), n.d(e, "EImageType", (function () { return r })), function (t) { t.PNG = "image/png", t.JPEG = "image/jpeg", t.GIF = "image/gif" }(r || (r = {})); var i = function (t, e, n, r) { return new (n || (n = Promise))((function (o, i) { function a(t) { try { u(r.next(t)) } catch (t) { i(t) } } function c(t) { try { u(r.throw(t)) } catch (t) { i(t) } } function u(t) { var e; t.done ? o(t.value) : (e = t.value, e instanceof n ? e : new n((function (t) { t(e) }))).then(a, c) } u((r = r.apply(t, e || [])).next()) })) }; function a(t, e = .92, n = r.JPEG) { return i(this, void 0, void 0, (function* () { return o(n) || (n = r.JPEG), t.toDataURL(n, e) })) } function c(t, e = .92, n = r.JPEG) { return new Promise(r => t.toBlob(t => r(t), n, e)) } var u = function (t, e, n, r) { return new (n || (n = Promise))((function (o, i) { function a(t) { try { u(r.next(t)) } catch (t) { i(t) } } function c(t) { try { u(r.throw(t)) } catch (t) { i(t) } } function u(t) { var e; t.done ? o(t.value) : (e = t.value, e instanceof n ? e : new n((function (t) { t(e) }))).then(a, c) } u((r = r.apply(t, e || [])).next()) })) }; function s(t, e) { return u(this, void 0, void 0, (function* () { const n = t.split(","); let r = n[0].match(/:(.*?);/)[1]; const i = atob(n[1]); let a = i.length; const c = new Uint8Array(a); for (; a--;)c[a] = i.charCodeAt(a); return o(e) && (r = e), new Blob([c], { type: r }) })) } function l(t) { return new Promise((e, n) => { const r = new Image; r.onload = () => e(r), r.onerror = () => n(new Error("dataURLtoImage(): dataURL is illegal")), r.src = t }) } function d(t, e) { const n = document.createElement("a"); n.href = window.URL.createObjectURL(t), n.download = e || Date.now().toString(36), document.body.appendChild(n); const r = document.createEvent("MouseEvents"); r.initEvent("click", !1, !1), n.dispatchEvent(r), document.body.removeChild(n) } function f(t) { return new Promise(e => { const n = new FileReader; n.onloadend = t => e(t.target.result), n.readAsDataURL(t) }) } var h = function (t, e, n, r) { return new (n || (n = Promise))((function (o, i) { function a(t) { try { u(r.next(t)) } catch (t) { i(t) } } function c(t) { try { u(r.throw(t)) } catch (t) { i(t) } } function u(t) { var e; t.done ? o(t.value) : (e = t.value, e instanceof n ? e : new n((function (t) { t(e) }))).then(a, c) } u((r = r.apply(t, e || [])).next()) })) }; function g(t, e = {}) { return h(this, void 0, void 0, (function* () { const n = Object.assign({}, e), r = document.createElement("canvas"), o = r.getContext("2d"); let i, a; for (const t in n) Object.prototype.hasOwnProperty.call(n, t) && (n[t] = Number(n[t])); if (n.scale) { const e = n.scale > 0 && n.scale < 10 ? n.scale : 1; a = t.width * e, i = t.height * e } else a = n.width || n.height * t.width / t.height || t.width, i = n.height || n.width * t.height / t.width || t.height; switch ([5, 6, 7, 8].some(t => t === n.orientation) ? (r.height = a, r.width = i) : (r.height = i, r.width = a), n.orientation) { case 3: o.rotate(180 * Math.PI / 180), o.drawImage(t, -r.width, -r.height, r.width, r.height); break; case 6: o.rotate(90 * Math.PI / 180), o.drawImage(t, 0, -r.width, r.height, r.width); break; case 8: o.rotate(270 * Math.PI / 180), o.drawImage(t, -r.height, 0, r.height, r.width); break; case 2: o.translate(r.width, 0), o.scale(-1, 1), o.drawImage(t, 0, 0, r.width, r.height); break; case 4: o.translate(r.width, 0), o.scale(-1, 1), o.rotate(180 * Math.PI / 180), o.drawImage(t, -r.width, -r.height, r.width, r.height); break; case 5: o.translate(r.width, 0), o.scale(-1, 1), o.rotate(90 * Math.PI / 180), o.drawImage(t, 0, -r.width, r.height, r.width); break; case 7: o.translate(r.width, 0), o.scale(-1, 1), o.rotate(270 * Math.PI / 180), o.drawImage(t, -r.height, 0, r.height, r.width); break; default: o.drawImage(t, 0, 0, r.width, r.height) }return r })) } function w(t) { return fetch(t).then(t => t.blob()) } function m(t) { return new Promise((e, n) => { const r = new Image; r.onload = () => e(r), r.onerror = () => n(new Error("urltoImage(): Image failed to load, please check the image URL")), r.src = t }) } var y = function (t, e, n, r) { return new (n || (n = Promise))((function (o, i) { function a(t) { try { u(r.next(t)) } catch (t) { i(t) } } function c(t) { try { u(r.throw(t)) } catch (t) { i(t) } } function u(t) { var e; t.done ? o(t.value) : (e = t.value, e instanceof n ? e : new n((function (t) { t(e) }))).then(a, c) } u((r = r.apply(t, e || [])).next()) })) }; function p(t, e = {}) { return y(this, void 0, void 0, (function* () { if (!(t instanceof Blob)) throw new Error("compress(): First arg must be a Blob object or a File object."); if ("object" != typeof e && (e = Object.assign({ quality: e })), e.quality = Number(e.quality), Number.isNaN(e.quality)) return t; const n = yield f(t); let i = n.split(",")[0].match(/:(.*?);/)[1], c = r.JPEG; o(e.type) && (c = e.type, i = e.type); const u = yield l(n), d = yield g(u, Object.assign({}, e)), h = yield a(d, e.quality, c), w = yield s(h, i); return w.size > t.size ? t : w })) } function b(t, e = {}) { return y(this, void 0, void 0, (function* () { if (!(t instanceof Blob)) throw new Error("compressAccurately(): First arg must be a Blob object or a File object."); if ("object" != typeof e && (e = Object.assign({ size: e })), e.size = Number(e.size), Number.isNaN(e.size)) return t; if (1024 * e.size > t.size) return t; e.accuracy = Number(e.accuracy), (!e.accuracy || e.accuracy < .8 || e.accuracy > .99) && (e.accuracy = .95); const n = e.size * (2 - e.accuracy) * 1024, i = 1024 * e.size, c = e.size * e.accuracy * 1024, u = yield f(t); let d = u.split(",")[0].match(/:(.*?);/)[1], h = r.JPEG; o(e.type) && (h = e.type, d = e.type); const w = yield l(u), m = yield g(w, Object.assign({}, e)); let y, p = .5; const b = [null, null]; for (let t = 1; t <= 7; t++) { y = yield a(m, p, h); const e = .75 * y.length; if (7 === t) { (n < e || c > e) && (y = [y, ...b].filter(t => t).sort((t, e) => Math.abs(.75 * t.length - i) - Math.abs(.75 * e.length - i))[0]); break } if (n < e) b[1] = y, p -= Math.pow(.5, t + 1); else { if (!(c > e)) break; b[0] = y, p += Math.pow(.5, t + 1) } } const v = yield s(y, d); return v.size > t.size ? t : v })) } }]) }));

// Utils

if (!window.DeferredFunction) {
	class DeferredFunction {
		constructor() {
			this.fn = null;
			this.queue = [];
			this.isRunning = false;
		}

		define(fn) {
			this.fn = fn;
			if (!this.isRunning && this.queue.length > 0) {
				this.processQueue();
			}
		}

		call(context = null, ...args) {
			const now = Date.now();
			this.queue.push({ context, args, timestamp: now });
			if (!this.isRunning && this.fn) {
				this.processQueue();
			}
		}

		async processQueue() {
			this.isRunning = true;

			let startTime;
			let previousTimestamp = 0;

			while (this.queue.length > 0) {
				const { context, args, timestamp } = this.queue.shift();

				startTime ??= timestamp;
				const relativeTimestamp = timestamp - startTime;

				if (previousTimestamp) {
					const delay = Math.max(0, relativeTimestamp - (Date.now() - startTime));
					await new Promise((resolve, reject) => setTimeout(resolve, delay));
				}

				if (this.fn) {
					await this.fn.apply(context, args);
				}

				previousTimestamp = relativeTimestamp;
			}

			this.isRunning = false;
		}
	}
	window.DeferredFunction = DeferredFunction;
}

function trackPromise(promise) {
	let state = 'pending';

	const wrappedPromise = promise
		.then(value => {
			state = 'resolved';
			return value;
		})
		.catch(err => {
			state = 'rejected';
			throw err;
		});

	wrappedPromise.getState = () => state;

	return wrappedPromise;
}

function debounce(fn, delay) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
}

// because apparently JS doesn't have this
function insort(array, obj, getKey = x => x) {
	let index = array.findIndex(item => getKey(obj) < getKey(item));
	if (index === -1) {
		array.push(obj);
	} else {
		array.splice(index, 0, obj);
	}
}

function getDocumentReady() {
	return this.readyState === 'interactive' || this.readyState === 'complete';
}

window.documentReady ??= getDocumentReady.bind(document);

function softRemove(e) {
	if (!e) return;
	e.style.display = 'none';
}

function persistentSoftRemove(element) {
	if (!element) return;
	observeElementChanges(element, softRemove);
}

function updateCSSProperty(currentProperty, key, value) {
	currentProperty = currentProperty || '';
	const regex = new RegExp(`${key}\\([^)]*\\)`, 'g');
	if (regex.test(currentProperty)) {
		return currentProperty.replace(regex, `${key}(${value})`);
	} else {
		return currentProperty ? `${currentProperty} ${key}(${value})` : `${key}(${value})`;
	}
}

function getElementByXPath(doc, xpath) {
	const result = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
	return result;
}

function getElementsByXPath(doc, xpath) {
	const result = [];
	const iterator = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
	let node = iterator.iterateNext();
	while (node) {
		result.push(node);
		node = iterator.iterateNext();
	}
	return result;
}

function getTraverse(check, callback) {
	function traverse(node) {
		if (check(node)) return callback(node);
		if (node.childNodes) {
			for (const child of node.childNodes) traverse(child);
		}
	}
	return traverse;
}

function startObserver(root, get, givenCheck, callback, initialCheck) {
	return new Promise((resolve, reject) => {
		if (!(root instanceof HTMLElement)) return reject(new Error("Invalid root element"));

		let observer;
		let firstMatch;
		let resolved = false;

		function check(e) {
			return e && e instanceof HTMLElement && givenCheck(e);
		}

		function done(e) {
			if (observer) {
				observer.disconnect();
				observer = null;
				firstMatch = e;
			}
		}

		const traverse = getTraverse(check, done);

		try {
			observer = new MutationObserver(async mutationsList => {
				for (const mutation of mutationsList) {
					for (const node of mutation.addedNodes) traverse(node);
					if (firstMatch && !resolved) {
						resolved = true;
						return resolve(await callback(firstMatch));
					}
				}
			});

			observer.observe(root, { subtree: true, childList: true });

			if (initialCheck) {
				setTimeout(async () => {
					if (typeof get !== "function") throw new Error("Invalid get function");
					const e = await get();
					if (!check(e)) return;
					if (observer) {
						observer.disconnect();
						observer = null;
					}
					if (!resolved) {
						resolved = true;
						return resolve(await callback(e));
					}
				}, 0);
			}
		} catch (error) {
			reject(error);
		}
	});
}

function startPObserver(root, get, check, childCallback, attributeCallback) {
	if (typeof childCallback !== 'function') throw new Error("Invalid childCallback function");
	let lastElement = null;
	let callback;
	if (typeof attributeCallback === 'function') {
		let attributeObserver = null;
		callback = e => {
			if (e === lastElement) return;

			lastElement = e;
			let promise;

			if (attributeObserver) {
				attributeObserver.disconnect();
				promise = childCallback(e);
			} else {
				promise = Promise.all([childCallback(e), attributeCallback(e)]);
			}

			attributeObserver = new MutationObserver(mutationsList => {
				mutationsList.forEach(function(mutation) {
					if (mutation.type === "attributes") attributeCallback(mutation.target);
				});
			})
			attributeObserver.observe(e, { attributes: true });
			
			return promise;
		};
	} else {
		callback = e => {
			if (e === lastElement) return;
			lastElement = e;
			return childCallback(e);
		};
	}
	function observe(initialCheck) {
		startObserver(root, get, check, callback, initialCheck).then(() => setTimeout(() => observe(false), 0));
	}
	observe(true);
}

function getStartPObserver(root) {
	return function (get, check, childCallback, attributeCallback) {
		startPObserver(root, get, check, childCallback, attributeCallback);
	};
}

function getStartAttributePObserver(root) {
	return function (tagName, attributeName, attributeValue, childCallback, attributeCallback, selectorSuffix = '') {
		startPObserver(root,
			() => root.querySelector(`${tagName}[${attributeName}="${attributeValue}"] ${selectorSuffix}`),
			e => e.tagName === tagName.toUpperCase() && e.getAttribute(attributeName) === attributeValue,
			childCallback, attributeCallback
		);
	};
}

function getPNthChild(root, indices,
	childCallback, attributeCallback,
	intermediateChildCallback = null, intermediateAttributeCallback = null) {
	if (!Array.isArray(indices)) indices = [indices];
	function help(currentRoot, remainingIndices, currentLevel = 0) {
		const index = remainingIndices[0];
		const get = () => currentRoot.children[index];
		const check = e => e === get();
		if (remainingIndices.length === 1) {
			startPObserver(currentRoot, get, check, childCallback, attributeCallback);
		} else {
			startPObserver(currentRoot, get, check, async child => {
				intermediateChildCallback?.(child, currentLevel);
				setTimeout(() => help(child, remainingIndices.slice(1), currentLevel + 1));
			}, e => intermediateAttributeCallback?.(e, currentLevel));
		}
	}
	help(root, indices);
}

function observeElementChanges(element, callback) {
	if (!element) return;

	const observer = new MutationObserver(() => callback(element));

	observer.observe(element, {
		subtree: true,
		childList: true,
		attributes: true,
		characterData: true,
	});

	callback(element);

	return () => observer.disconnect();
}

function startObserverOnInterval(rootGetter, refGetter, refSetter, intervalGetter, intervalSetter, get, check, callback, cooldown) {
	function wrappedCallback(tmp) {
		if (tmp === refGetter() || tmp?.childElementCount === 0) return;
		refSetter(tmp);
		callback();
		if (intervalGetter()) clearInterval(intervalGetter());
		intervalSetter(setInterval(help, cooldown));
	}

	function help() {
		startObserver(rootGetter(), get, check, wrappedCallback);
	}

	help();
}

function getStartObserverOnInterval(rootGetter, refGetter, refSetter, intervalGetter, intervalSetter) {
	return function (get, check, callback, cooldown = 100) {
		return startObserverOnInterval(rootGetter, refGetter, refSetter, intervalGetter, intervalSetter, get, check, callback, cooldown);
	}
}

window.dispatchEvent(new Event('commonLoaded'));
