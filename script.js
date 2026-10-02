import * as gifuct from 'https://esm.sh/gifuct-js@2.1.2';
import * as skinview3d from 'https://esm.sh/skinview3d@3.4.2';

const TARGET = { x: 6, y: 6, width: 60, height: 96, maxBytes: 35 * 1024 };
const $ = (id) => document.getElementById(id);
const state = { file:null, skinFiles:[], skinUrl:null, previewSkinImage:null, frames:[], capeBlobs:[], capeImages:[], skinViewer:null, switching:false, playing:false, processing:false, timer:null, lang:'ja', pckBlob:null, pckFilename:'', previewFrame:0 };
const template = new Image();
template.src = 'image/TemplateCapes.png';

function setStatus(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function setProgress(value, visible = true) { $('progress').style.display = visible ? 'block' : 'none'; $('progress').firstElementChild.style.width = `${value * 100}%`; }
function updateText() { document.querySelectorAll('[data-ja]').forEach((el) => { el.textContent = el.dataset[state.lang]; }); }
function initializePreview() {
	const canvas = $('previewCanvas');
	const stage = $('stageWrap');
	state.skinViewer = new skinview3d.SkinViewer({ canvas, width:stage.clientWidth, height:stage.clientHeight, zoom:.86 });
	state.skinViewer.autoRotate = false;
	state.skinViewer.controls.enableRotate = true;
	state.skinViewer.controls.enableZoom = true;
	state.skinViewer.controls.enablePan = false;
	state.skinViewer.playerWrapper.rotation.y = 0;
	state.skinViewer.playerObject.cape.cape.geometry.scale(1,1,1.7);
	const resize = () => {
		state.skinViewer.width = stage.clientWidth;
		state.skinViewer.height = stage.clientHeight;
		state.skinViewer.zoom = Math.min(.95, Math.max(.55, Math.min(stage.clientWidth/620,stage.clientHeight/420)));
	};
	new ResizeObserver(resize).observe($('stageWrap'));
	resize();
	state.skinViewer.controls.target.set(0,0,0);
	state.skinViewer.camera.position.set(14,3,-72);
	state.skinViewer.camera.lookAt(0,0,0);
	state.skinViewer.controls.update();
}
function setSkinTexture(image) {
	state.skinViewer.loadSkin(image);
	$('previewPlaceholder').hidden = true;
}
async function loadPreviewSkin(file) {
	const url = URL.createObjectURL(file);
	const image = new Image();
	try {
		await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
		if (image.width !== image.height && image.width !== image.height * 2) throw new Error('スキン画像は64×64または64×32形式にしてください');
		if (state.skinUrl) URL.revokeObjectURL(state.skinUrl);
		state.skinUrl = url; state.previewSkinImage = image; setSkinTexture(image);
	} catch (error) { URL.revokeObjectURL(url); setStatus(error.message, true); }
}
async function makeCapeTexture(frameBlob) {
	const source = await createImageBitmap(frameBlob);
	const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 192;
	const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
	const drawRegion = (sx, sy, sw, sh, dx, dy, dw, dh) => context.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
	drawRegion(TARGET.x, TARGET.y, 60, 96, 6, 6, 60, 96);
	drawRegion(TARGET.x, TARGET.y, 60, 96, 72, 6, 60, 96);
	drawRegion(TARGET.x, TARGET.y, 60, 1, 6, 0, 60, 6);
	drawRegion(TARGET.x, TARGET.y + 95, 60, 1, 66, 0, 60, 6);
	drawRegion(TARGET.x, TARGET.y, 1, 96, 0, 6, 6, 96);
	drawRegion(TARGET.x + 59, TARGET.y, 1, 96, 66, 6, 6, 96);
	source.close();
	return canvasBlob(canvas);
}
function setCapeFrame(index){if(state.skinViewer&&state.capeImages[index])state.skinViewer.loadCape(state.capeImages[index]);}
async function setFrame(index) { if (!state.frames.length || state.switching) return; state.switching = true; try { const safe = Math.max(0, Math.min(index, state.frames.length - 1)); state.previewFrame = safe; setCapeFrame(safe); $('frameSlider').value = safe; $('frameLabel').textContent = `${safe + 1} / ${state.frames.length}`; } finally { state.switching = false; } }
function canvasBlob(canvas) { return new Promise((resolve) => canvas.toBlob(resolve, 'image/png')); }
async function encodeFrame(source) {
	const canvas = document.createElement('canvas'); canvas.width = template.naturalWidth || 512; canvas.height = template.naturalHeight || 288;
	const context = canvas.getContext('2d'); context.drawImage(template, 0, 0);
	let scale = 1;
	while (scale >= .25) {
		context.clearRect(TARGET.x, TARGET.y, TARGET.width, TARGET.height); context.drawImage(template, 0, 0);
		context.imageSmoothingQuality = 'high'; context.drawImage(source, TARGET.x, TARGET.y, TARGET.width * scale, TARGET.height * scale);
		const blob = await canvasBlob(canvas); if (blob.size <= TARGET.maxBytes || scale <= .25) return blob;
		scale -= .1;
	}
	return canvasBlob(canvas);
}
async function loadGif(file) {
	const buffer = await file.arrayBuffer(); const parsed = gifuct.parseGIF(buffer); const frames = gifuct.decompressFrames(parsed, true);
	const canvas = document.createElement('canvas'); canvas.width = parsed.lsd.width; canvas.height = parsed.lsd.height; const ctx = canvas.getContext('2d');
	const sources = [];
	for (const frame of frames) {
		const previous = frame.disposalType === 3 ? document.createElement('canvas') : null;
		if (previous) { previous.width = canvas.width; previous.height = canvas.height; previous.getContext('2d').drawImage(canvas, 0, 0); }
		const patchCanvas = document.createElement('canvas'); patchCanvas.width = frame.dims.width; patchCanvas.height = frame.dims.height; patchCanvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height), 0, 0); ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
		const snapshot = document.createElement('canvas'); snapshot.width = canvas.width; snapshot.height = canvas.height; snapshot.getContext('2d').drawImage(canvas, 0, 0); sources.push(snapshot);
		if (frame.disposalType === 2) ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
		if (previous) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(previous, 0, 0); }
	}
	return sources;
}
function seek(video, time) { return new Promise((resolve) => { video.onseeked = resolve; video.currentTime = time; }); }
async function loadMp4(file) {
	const video = document.createElement('video'); video.src = URL.createObjectURL(file); video.muted = true; video.playsInline = true; await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });
	const count = Math.max(1, Math.ceil(video.duration * 12)); const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; const ctx = canvas.getContext('2d'); const frames = [];
	for (let i = 0; i < count; i++) { await seek(video, Math.min(i / 12, Math.max(0, video.duration - .001))); ctx.drawImage(video, 0, 0); frames.push(canvas.toDataURL()); }
	URL.revokeObjectURL(video.src); return frames;
}
async function processFile() {
	if (!state.file || !template.complete || state.processing) return; state.processing = true; $('processBtn').disabled = true; $('downloadBtn').disabled = true; $('downloadPckBtn').disabled = true; setProgress(0); setStatus(state.lang === 'ja' ? 'フレームを解析しています...' : 'Reading frames...');
	try {
		let sources = state.file.type === 'image/gif' || state.file.name.toLowerCase().endsWith('.gif') ? await loadGif(state.file) : await loadMp4(state.file);
		state.frames = []; state.capeBlobs = []; state.capeImages.forEach((image) => image.close()); state.capeImages = [];
		for (let i = 0; i < sources.length; i++) { const source = typeof sources[i] === 'string' ? await new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(image); image.src = sources[i]; }) : sources[i]; const blob = await encodeFrame(source); const capeBlob = await makeCapeTexture(blob); state.frames.push(blob); state.capeBlobs.push(capeBlob); state.capeImages.push(await createImageBitmap(capeBlob)); setProgress((i + 1) / sources.length); }
		$('frameCount').textContent = state.frames.length; $('sizeInfo').textContent = `${Math.round(state.frames[0].size / 1024)}KB`; $('frameSlider').max = state.frames.length - 1; $('frameSlider').disabled = false; $('playBtn').disabled = false; $('downloadBtn').disabled = false; await setFrame(0);
		if (state.skinFiles.length) { state.pckBlob = await buildPck(); state.pckFilename = `${safePackName($('packNameInput').value)}.pck`; $('downloadPckBtn').disabled = false; const pairCount = Math.max(state.skinFiles.length, state.frames.length); setStatus(state.lang === 'ja' ? `${pairCount}個のスキンとcape PNGのペアでPCKを作成しました` : `PCK created with ${pairCount} skin and cape pairs`); }
		else { setStatus(state.lang === 'ja' ? `${state.frames.length}フレームを変換しました。スキンPNGを選ぶとPCKを作成します` : `${state.frames.length} frames converted. Add a skin PNG to create the PCK`); }
		setProgress(1, false);
	} catch (error) { console.error(error); setStatus(state.lang === 'ja' ? `変換に失敗しました: ${error.message}` : `Conversion failed: ${error.message}`, true); setProgress(0, false); }
	$('processBtn').disabled = false; state.processing = false;
}
async function downloadZip() { const zip = new JSZip(); state.frames.forEach((blob, index) => zip.file(`cape${index}.png`, blob)); $('downloadBtn').disabled = true; setStatus(state.lang === 'ja' ? 'ZIPを作成しています...' : 'Creating ZIP...'); const blob = await zip.generateAsync({ type:'blob', compression:'STORE' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'cape-frames.zip'; link.click(); URL.revokeObjectURL(link.href); $('downloadBtn').disabled = false; setStatus(state.lang === 'ja' ? 'ZIPをダウンロードしました' : 'ZIP downloaded'); }
function sanitizeName(name) { return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'cape-skin-pack'; }
function safePackName(filename) { return sanitizeName(filename.replace(/\.[^.]+$/, '')); }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function joinBytes(chunks) { const result=new Uint8Array(chunks.reduce((sum,chunk)=>sum+chunk.length,0));let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result; }
function uint32Bytes(value,littleEndian) { const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,value,littleEndian);return bytes; }
function pckString(value,littleEndian) {
	const text=String(value), bytes=new Uint8Array(4+text.length*2+4), view=new DataView(bytes.buffer);
	view.setUint32(0,text.length,littleEndian);
	for(let index=0;index<text.length;index++)view.setUint16(4+index*2,text.charCodeAt(index),littleEndian);
	view.setUint32(4+text.length*2,0,littleEndian);return bytes;
}
function locString(value) { const text=new TextEncoder().encode(value), length=new Uint8Array(2);new DataView(length.buffer).setUint16(0,text.length,false);return joinBytes([length,text]); }
function buildLocBuffer(languages,keys,locData) {
	const header=[uint32Bytes(2,false),uint32Bytes(languages.length,false),new Uint8Array([0]),uint32Bytes(keys.length,false)];
	for(const key of keys)header.push(locString(key));
	const entries=[];
	for(const language of languages){
		const lang=locString(language);header.push(lang);
		const entry=[uint32Bytes(2,false),new Uint8Array([0]),lang,uint32Bytes(keys.length,false)];
		for(const key of keys)entry.push(locString(locData[language]?.[key]||''));
		const entryBytes=joinBytes(entry);header.push(uint32Bytes(entryBytes.length,false));entries.push(entryBytes);
	}
	return joinBytes([...header,...entries]);
}
function encodePck(assets,pckType,littleEndian) {
	const properties=new Map();
	for(const asset of assets)for(const property of asset.properties||[])if(!properties.has(property.key))properties.set(property.key,properties.size);
	const chunks=[uint32Bytes(pckType,littleEndian),uint32Bytes(properties.size,littleEndian)];
	for(const [key,index] of properties){chunks.push(uint32Bytes(index,littleEndian),pckString(key,littleEndian));}
	chunks.push(uint32Bytes(assets.length,littleEndian));
	for(const asset of assets)chunks.push(uint32Bytes(asset.data.byteLength,littleEndian),uint32Bytes(asset.typeCode,littleEndian),pckString(asset.filename,littleEndian));
	for(const asset of assets){
		const assetProperties=asset.properties||[];chunks.push(uint32Bytes(assetProperties.length,littleEndian));
		for(const property of assetProperties){chunks.push(uint32Bytes(properties.get(property.key),littleEndian),pckString(property.value,littleEndian));}
		chunks.push(asset.data);
	}
	return joinBytes(chunks);
}
async function buildPck() {
	const packName = sanitizeName($('packNameInput').value);
	const packId = Number($('packIdInput').value);
	if (!Number.isInteger(packId) || packId < 0 || packId > 0xffffff) throw new Error('PACKIDは0～16777215の整数を入力してください');
	if (!state.skinFiles.length) throw new Error('スキンPNGを1枚以上選択してください');
	const skinNamePrefix = sanitizeName($('skinNamePrefixInput').value);
	const pairCount = Math.max(state.skinFiles.length, state.frames.length);
	const randomBase = 100000 + crypto.getRandomValues(new Uint32Array(1))[0] % (99899999 - pairCount + 1);
	const skinEntries = [];
	for (let index = 0; index < pairCount; index++) {
		const id = randomBase + index;
		const paddedId = String(id).padStart(8, '0');
		const skinName = `${skinNamePrefix} ${String(index + 1).padStart(2, '0')}`;
		const capeFilename = `dlccape${paddedId}.png`;
		const properties = [
			{ key:'DISPLAYNAME', value:skinName },
			{ key:'DISPLAYNAMEID', value:`IDS_dlcskin${paddedId}_DISPLAYNAME` },
			{ key:'ANIM', value:'0x00040000' },
			{ key:'GAME_FLAGS', value:'0x18' },
			{ key:'FREE', value:'1' },
			{ key:'CAPEPATH', value:capeFilename }
		];
		const skinFile = state.skinFiles[index % state.skinFiles.length];
		const capeFrame = state.capeBlobs[index % state.capeBlobs.length];
		skinEntries.push({ id:paddedId, name:skinName, filename:`dlcskin${paddedId}.png`, capeFilename, properties, data:new Uint8Array(await skinFile.arrayBuffer()), capeData:new Uint8Array(await capeFrame.arrayBuffer()) });
	}
	const languages = ['cs-CS','cs-CZ','da-DA','da-DK','de-DE','el-EL','el-GR','en-EN','en-GB','es-ES','es-MX','fi-FI','fr-FR','it-IT','ja-JP','ko-KR','la-LAS','nb-NO','nl-NL','no-NO','pl-PL','pt-BR','pt-PT','ru-RU','sk-SK','sv-SE','sv-SV','tr-TR','zh-CHT','zh-CN','zh-HANS','zh-HANT'];
	const locKeys = ['IDS_DISPLAY_NAME', ...skinEntries.map((entry) => `IDS_dlcskin${entry.id}_DISPLAYNAME`)];
	const locData = Object.fromEntries(languages.map((language) => [language, Object.fromEntries(locKeys.map((key, index) => [key, index === 0 ? packName : skinEntries[index - 1].name]))]));
	const locBytes = buildLocBuffer(languages,locKeys,locData);
	const assets = [
		{ filename:'0', typeCode:4, properties:[{ key:'PACKID', value:String(packId) }], data:new Uint8Array(0), dataSize:0 },
		{ filename:'localisation.loc', typeCode:6, properties:[], data:locBytes, dataSize:locBytes.byteLength },
	];
	for (const entry of skinEntries) {
		assets.push({ filename:entry.filename, typeCode:0, properties:entry.properties, data:entry.data, dataSize:entry.data.byteLength });
		assets.push({ filename:entry.capeFilename, typeCode:1, properties:[], data:entry.capeData, dataSize:entry.capeData.byteLength });
	}
	const littleEndian = document.querySelector('input[name="pckEndian"]:checked')?.value === 'little';
	return new Blob([encodePck(assets,8,littleEndian)], { type:'application/octet-stream' });
}
function clearGeneratedFiles() { state.pckBlob = null; state.pckFilename = ''; $('downloadPckBtn').disabled = true; $('downloadBtn').disabled = true; }
initializePreview();
function selectAnimation(file) { if (!file) return; state.file = file; $('fileName').textContent = file.name; clearGeneratedFiles(); $('processBtn').disabled = false; setStatus(''); if (state.skinFiles.length) processFile(); }
$('fileInput').addEventListener('change', (event) => selectAnimation(event.target.files[0]));
$('skinInput').addEventListener('change', (event) => { const files = Array.from(event.target.files); if (!files.length) return; if (files.some((file) => !file.name.toLowerCase().endsWith('.png'))) { setStatus(state.lang === 'ja' ? 'スキンはPNG画像を選択してください' : 'Choose PNG skin images', true); return; } state.skinFiles = files; $('skinName').textContent = files.length === 1 ? files[0].name : `${files.length}枚のPNG`; loadPreviewSkin(files[0]); clearGeneratedFiles(); if (state.file) processFile(); });
$('processBtn').addEventListener('click', processFile); $('downloadBtn').addEventListener('click', downloadZip); $('frameSlider').addEventListener('input', (event) => { setFrame(Number(event.target.value)); });
$('downloadPckBtn').addEventListener('click', () => { if (state.pckBlob) downloadBlob(state.pckBlob, state.pckFilename); });
['packNameInput','packIdInput','skinNamePrefixInput'].forEach((id) => $(id).addEventListener('input', () => { clearGeneratedFiles(); if (state.file && state.skinFiles.length) setStatus(state.lang === 'ja' ? '設定を変更しました。「変換する」を押すとPCKを作り直します' : 'Settings changed. Click Convert to rebuild the PCK'); }));
document.querySelectorAll('input[name="pckEndian"]').forEach((radio) => radio.addEventListener('change', () => { clearGeneratedFiles(); if (state.file && state.skinFiles.length) setStatus(state.lang === 'ja' ? 'バイト順を変更しました。「変換する」を押すとPCKを作り直します' : 'Byte order changed. Click Convert to rebuild the PCK'); }));
$('playBtn').addEventListener('click', () => { state.playing = !state.playing; $('playBtn').textContent = state.playing ? (state.lang === 'ja' ? 'Ⅱ 停止' : 'Ⅱ Pause') : (state.lang === 'ja' ? '▶ 再生' : '▶ Play'); if (state.playing) { state.timer = setInterval(async () => { if (!state.switching) await setFrame((Number($('frameSlider').value) + 1) % state.frames.length); }, 100); } else clearInterval(state.timer); });
document.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => { state.lang = button.dataset.lang; document.querySelectorAll('[data-lang]').forEach((item) => item.classList.toggle('active', item === button)); updateText(); }));
['dragenter','dragover'].forEach((eventName) => $('dropZone').addEventListener(eventName, (event) => { event.preventDefault(); $('dropZone').classList.add('dragover'); })); $('dropZone').addEventListener('dragleave', () => $('dropZone').classList.remove('dragover')); $('dropZone').addEventListener('drop', (event) => { event.preventDefault(); $('dropZone').classList.remove('dragover'); const file = event.dataTransfer.files[0]; if (file) { $('fileInput').files = event.dataTransfer.files; $('fileInput').dispatchEvent(new Event('change')); } });
['dragenter','dragover'].forEach((eventName) => $('skinDropZone').addEventListener(eventName, (event) => { event.preventDefault(); $('skinDropZone').classList.add('dragover'); })); $('skinDropZone').addEventListener('dragleave', () => $('skinDropZone').classList.remove('dragover')); $('skinDropZone').addEventListener('drop', (event) => { event.preventDefault(); $('skinDropZone').classList.remove('dragover'); const file = event.dataTransfer.files[0]; if (file) { $('skinInput').files = event.dataTransfer.files; $('skinInput').dispatchEvent(new Event('change')); } });