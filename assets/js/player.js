window.addEventListener("message", async e => {

	// Meta para testar o player APENAS em localhost
	if (window.location.href == "http://127.0.0.1:5500/") {
		let meta = document.createElement('meta');
		meta.httpEquiv = "Content-Security-Policy";
		meta.content = "upgrade-insecure-requests";
		document.getElementsByTagName('head')[0].appendChild(meta);
	}

	console.log('[CR Premium] Player encontrado!')

	// Variáveis principais
	const promises=[], request = [];
	const r = { 0: '720p', 1: '1080p', 2: '480p', 3: '360p', 4: '240p' };
	for (let i in r) promises[i] = new Promise((resolve, reject) => request[i] = { resolve, reject });

	let rgx = /http.*$/gm;
	let streamrgx = /_,(\d+.mp4),(\d+.mp4),(\d+.mp4),(\d+.mp4),(\d+.mp4),.*?m3u8/;
	let video_config_media = JSON.parse(e.data.video_config_media);
	let allorigins = "https://crp-proxy.herokuapp.com/get?url=";
	let video_id = video_config_media['metadata']['id'];
	let user_lang = e.data.lang;
	let episode_translate = "";
	let video_stream_url = "";
	let video_m3u8_array = [];
	let video_mp4_array = [];
	let final_translate = "";
	let episode_title = "";
	let rows_number = 0;
	let sources = [];
	
	let dlSize = [];
	let dlUrl = [];
	for (let idx in r) {
		dlSize[idx] = document.getElementById(r[idx] + "_down_size");
		dlUrl[idx] = document.getElementById(r[idx] + "_down_url");
	}

	// Obter streams
	for (let stream of video_config_media['streams']) {
		// Premium
		if (stream.format == 'trailer_hls' && stream.hardsub_lang == null)
			if (rows_number <= 4) {
				// video_m3u8_array.push(await getDirectStream(stream.url, rows_number));
				video_mp4_array.push(getDirectFile(stream.url));
				rows_number++;
				// mp4 + resolve temporario até pegar link direto da m3u8
				if (rows_number > 4) {
					video_m3u8_array = video_mp4_array;
					for (let i in r) {
						const idx = i;
						setTimeout(() => request[idx].resolve(), 400);
					}
					break;
				}
			}
		// Padrão
		if (stream.format == 'adaptive_hls' && stream.hardsub_lang == null) {
			video_stream_url = stream.url;
			video_m3u8_array = await m3u8ListFromStream(video_stream_url);
			video_mp4_array = mp4ListFromStream(video_stream_url);
			break;
		}
	}

	// Pega o numero e titulo do episodio
	const epLangs = { "ptBR": "Episódio", "enUS": "EPISODE", "enGB": "Episode", "esLA": "Episodio", "esES": "Episodio", "ptPT": "Episódio", "frFR": "Épisode", "deDE": "Folge", "arME": "الحلقة", "itIT": "Episodio", "ruRU": "Серия" };
	const fnLangs = { "ptBR": "FINAL", "enUS": "FINAL", "enGB": "FINAL", "esLA": "FINAL", "esES": "FINAL", "ptPT": "FINAL", "frFR": "FINALE", "deDE": "FINALE", "arME": "نهائي", "itIT": "FINALE", "ruRU": "ФИНАЛЬНЫЙ" };
	episode_translate = `${epLangs[user_lang[0]] ? epLangs[user_lang[0]] : "Episode"} `;
	final_translate   = ` (${fnLangs[user_lang[0]] ? fnLangs[user_lang[0]] : "FINAL"})`;

	if (video_config_media['metadata']['up_next']) {
		let prox_ep_number = video_config_media['metadata']['up_next']['display_episode_number'];
		episode_title = video_config_media['metadata']['up_next']['series_title'] + ' - ' + prox_ep_number.replace(/\d+|OVA/g, '') + video_config_media['metadata']['display_episode_number'];
	} else
		episode_title = episode_translate + video_config_media['metadata']['display_episode_number'] + final_translate;

	// Checa se o URL do video_mp4_array[id] existe e calcula o tamanho p/ download
	function linkDownload(id) {
		console.log('  - Baixando: ', r[id])
		let video_mp4_url = video_mp4_array[id];

		let fileSize = "";
		let http = (window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP"));
		http.onreadystatechange = () => {
			if (http.readyState == 4 && http.status == 200) {
				fileSize = http.getResponseHeader('content-length');
				if (!fileSize)
					return setTimeout(() => linkDownload(id), 5000);
				else {
					let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
					if (fileSize == 0) return console.log('addSource#fileSize == 0');
					let i = parseInt(Math.floor(Math.log(fileSize) / Math.log(1024)));
					if (i == 0) return console.log('addSource#i == 0');
					let return_fileSize = (fileSize / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
					dlSize[id].innerText = return_fileSize;
					return console.log(`[CR Premium] Source adicionado: ${r[id]} (${return_fileSize})`);
				}
			} else if (http.readyState == 4)
				return setTimeout(() => linkDownload(id), 5000);
		}
		http.open("HEAD", video_mp4_url, true);
		http.send(null);
	}

	// Carregar player assim que encontrar as URLs dos m3u8.
	Promise.all(promises).then(() => {
		for (let idx of [1, 0, 2, 3, 4])
			sources.push({ file: video_m3u8_array[idx], label: r[idx] + (idx<2 ? '<sup><sup>HD</sup></sup>' : '')});
		startPlayer();
	});

	function startPlayer() {
		// Inicia o player
		let playerInstance = jwplayer("player_div")
		playerInstance.setup({
			"title": episode_title,
			"description": video_config_media['metadata']['title'],
			"sources": sources,
			"image": video_config_media['thumbnail']['url'],
			"width": "100%",
			"height": "100%",
			"autostart": false,
			"displayPlaybackLabel": true,
			"primary": "html5",
			"playbackRateControls": [0.5, 0.75, 1, 1.25, 1.5, 2]
		});

		// Variaveis para o botao de baixar.
		let button_iconPath = "assets/icon/download_icon.svg";
		let buttonId = "download-video-button";
		let button_tooltipText = "Download";
		let didDownload = false;

		// funcion ao clicar no botao de fechar o menu de download
		const downloadModal = document.querySelectorAll(".modal")[0];
		document.querySelectorAll("button.close-modal")[0].onclick = () =>
			downloadModal.style.visibility = "hidden";

		// function ao clicar no botao de baixar
		function download_ButtonClickAction() {
			// Se estiver no mobile, muda um pouco o design do menu
			if (jwplayer().getEnvironment().OS.mobile == true) {
				downloadModal.style.height = "170px";
				downloadModal.style.overflow = "auto";
			}
			
			// Mostra o menu de download
			downloadModal.style.visibility = downloadModal.style.visibility === "hidden" ? "visible" : "hidden";
			
			// Carrega os downloads
			if (!didDownload) {
				didDownload = true;
				console.log('[CR Premium] Baixando sources:')
				for (let id of [1,0,2,3,4])
					linkDownload(id);
			}
		}
		playerInstance.addButton(button_iconPath, button_tooltipText, download_ButtonClickAction, buttonId);

		// Definir URL e Tamanho na lista de download
		for (let id of [1,0,2,3,4]) {
      			dlUrl[id].href = video_mp4_array[id];
			dlUrl[id].download = video_config_media['metadata']['title'];
		}

		// Funções para o player
		jwplayer().on('ready', e => {
			// Seta o tempo do video pro salvo no localStorage		
			if (localStorage.getItem(video_id) != null)
				document.getElementsByTagName("video")[0].currentTime = localStorage.getItem(video_id);
			document.body.querySelector(".loading_container").style.display = "none";
		});

		// Mostra uma tela de erro caso a legenda pedida não exista.
		jwplayer().on('error', e => {
			console.log(e)
			if (e.code == 232011) {
				jwplayer().load({
					file: "https://i.imgur.com/OufoM33.mp4"
				});
				jwplayer().setControls(false);
				jwplayer().setConfig({
					repeat: true
				});
				jwplayer().play();
			}
		});
		
		// Fica salvando o tempo do video a cada 7 segundos.
		setInterval(() => {
			if (jwplayer().getState() == "playing")
				localStorage.setItem(video_id, jwplayer().getPosition());
		}, 7000);
	}

	/* ~~~~~~~~~~ FUNÇÕES ~~~~~~~~~~ */
	function getAllOrigins(url) {
		return new Promise(async (resolve, reject) => {
			await $.ajax({
				async: true,
				type: "GET",
				url: allorigins + encodeURIComponent(url),
				responseType: 'json'
			})
			.then(res=>{
				resolve(res.contents)
			})
			.catch(err=>reject(err));
		})
	}

	// ---- MP4 ---- (baixar)
	// Obtem o link direto pelo trailer (premium)
	function getDirectFile(url) {
		return url.replace(/\/clipFrom.*?index.m3u8/, '').replace('_,', '_').replace(url.split("/")[2], "fy.v.vrv.co");
	}

	// Obtem o link direto pelo padrão (gratis)
	function mp4ListFromStream(url) {
		const cleanUrl = url.replace('evs1', 'evs').replace(url.split("/")[2], "fy.v.vrv.co");
		const res = [];
		for (let i in r)
			res.push(cleanUrl.replace(streamrgx, `_$${(parseInt(i)+1)}`))
		return res;
	}

	// ---- M3U8 ---- (assistir)
	// Obtem o link direto pelo trailer (premium) - to do
	function getDirectStream(url, idx) {
		setTimeout(() => request[idx].resolve(), 400);
	}

	// Obtem o link direto pelo padrão (gratis)
	async function m3u8ListFromStream(url) {
		let m3u8list = []
		const master_m3u8 = await getAllOrigins(url);

		if (master_m3u8) {
			streams = master_m3u8.match(rgx)
			m3u8list = streams.filter((el, idx) => idx%2===0) // %2 === 0 pois há cdns da akamai e da cloudflare
		} else {
			for (let i in r) {
				const idx = i;
				setTimeout(() => request[idx].reject('Manifest m3u8ListFromStream#master_m3u8.length === 0'), 400);
			}
			return [];
		}

		const res = [];
		for (let i in m3u8list) {
			const video_m3u8 = await getAllOrigins(m3u8list[i]);
			m3u8list[i] = blobStream(video_m3u8);
		}
		
		res.push(buildM3u8(m3u8list));
		for (let i in r) {
			const idx = i;
			setTimeout(() => request[idx].resolve(), 400);
		}

		return res;
	}

	function blobStream(stream) {
		const blob = new Blob([stream], {
			type: "text/plain; charset=utf-8"
		});
		return URL.createObjectURL(blob) + "#.m3u8";
	}

	function buildM3u8(m3u8list) {
		const video_m3u8 = '#EXTM3U' +
		'\n#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=4112345,RESOLUTION=1280x720,FRAME-RATE=23.974,CODECS="avc1.640028,mp4a.40.2"' +
		'\n' + m3u8list[0] +
		'\n#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=8098235,RESOLUTION=1920x1080,FRAME-RATE=23.974,CODECS="avc1.640028,mp4a.40.2"' +
		'\n' + m3u8list[1] +
		'\n#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=2087088,RESOLUTION=848x480,FRAME-RATE=23.974,CODECS="avc1.4d401f,mp4a.40.2"' +
		'\n' + m3u8list[2] +
		'\n#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=1090461,RESOLUTION=640x360,FRAME-RATE=23.974,CODECS="avc1.4d401e,mp4a.40.2"' +
		'\n' + m3u8list[3] +
		'\n#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=559942,RESOLUTION=428x240,FRAME-RATE=23.974,CODECS="avc1.42c015,mp4a.40.2"' +
		'\n' + m3u8list[4];
		return blobStream(video_m3u8);
	}

let titlea = video_config_media['metadata']['title'];
document.getElementById("title").innerHTML = titlea;
let episodenum = video_config_media['metadata']['display_episode_number'];
let epi = "EPISODE ";
document.getElementById("episode").innerHTML = epi + episodenum;
let imagea = video_config_media['thumbnail']['url'];
document.getElementById("image").innerHTML = imagea;
let desc = video_config_media['metadata']['description'];
document.getElementById("desc").innerHTML = desc;

let subname0 = video_config_media['subtitles'][0]['language'];
document.getElementById("subname0").innerHTML = subname0;
let suburl0 = video_config_media['subtitles'][0]['url'];
let suburl0split = suburl0.split('?')[0];
let result0 = suburl0split.replace("https://v", "https://fy.v");
document.getElementById("suburl0").innerHTML = result0;

let subname1 = video_config_media['subtitles'][1]['language'];
document.getElementById("subname1").innerHTML = subname1;
let suburl1 = video_config_media['subtitles'][1]['url'];
let suburl1split = suburl1.split('?')[0];
let result1 = suburl1split.replace("https://v", "https://fy.v");
document.getElementById("suburl1").innerHTML = result1;

let subname2 = video_config_media['subtitles'][2]['language'];
document.getElementById("subname2").innerHTML = subname2;
let suburl2 = video_config_media['subtitles'][2]['url'];
let suburl2split = suburl2.split('?')[0];
let result2 = suburl2split.replace("https://v", "https://fy.v");
document.getElementById("suburl2").innerHTML = result2;

let subname3 = video_config_media['subtitles'][3]['language'];
document.getElementById("subname3").innerHTML = subname3;
let suburl3 = video_config_media['subtitles'][3]['url'];
let suburl3split = suburl3.split('?')[0];
let result3 = suburl3split.replace("https://v", "https://fy.v");
document.getElementById("suburl3").innerHTML = result3;

let subname4 = video_config_media['subtitles'][4]['language'];
document.getElementById("subname4").innerHTML = subname4;
let suburl4 = video_config_media['subtitles'][4]['url'];
let suburl4split = suburl4.split('?')[0];
let result4 = suburl4split.replace("https://v", "https://fy.v");
document.getElementById("suburl4").innerHTML = result4;

let subname5 = video_config_media['subtitles'][5]['language'];
document.getElementById("subname5").innerHTML = subname5;
let suburl5 = video_config_media['subtitles'][5]['url'];
let suburl5split = suburl5.split('?')[0];
let result5 = suburl5split.replace("https://v", "https://fy.v");
document.getElementById("suburl5").innerHTML = result5;

let subname6 = video_config_media['subtitles'][6]['language'];
document.getElementById("subname6").innerHTML = subname6;
let suburl6 = video_config_media['subtitles'][6]['url'];
let suburl6split = suburl6.split('?')[0];
let result6 = suburl6split.replace("https://v", "https://fy.v");
document.getElementById("suburl6").innerHTML = result6;

let subname7 = video_config_media['subtitles'][7]['language'];
document.getElementById("subname7").innerHTML = subname7;
let suburl7 = video_config_media['subtitles'][7]['url'];
let suburl7split = suburl7.split('?')[0];
let result7 = suburl7split.replace("https://v", "https://fy.v");
document.getElementById("suburl7").innerHTML = result7;

let subname8 = video_config_media['subtitles'][8]['language'];
document.getElementById("subname8").innerHTML = subname8;
let suburl8 = video_config_media['subtitles'][8]['url'];
let suburl8split = suburl8.split('?')[0];
let result8 = suburl8split.replace("https://v", "https://fy.v");
document.getElementById("suburl8").innerHTML = result8;

let subname9 = video_config_media['subtitles'][9]['language'];
document.getElementById("subname9").innerHTML = subname9;
let suburl9 = video_config_media['subtitles'][9]['url'];
let suburl9split = suburl9.split('?')[0];
let result9 = suburl9split.replace("https://v", "https://fy.v");
document.getElementById("suburl9").innerHTML = result9;

let subname10 = video_config_media['subtitles'][10]['language'];
document.getElementById("subname10").innerHTML = subname10;
let suburl10 = video_config_media['subtitles'][10]['url'];
let suburl10split = suburl10.split('?')[0];
let result10 = suburl10split.replace("https://v", "https://fy.v");
document.getElementById("suburl10").innerHTML = result10;

let subname11 = video_config_media['subtitles'][11]['language'];
document.getElementById("subname11").innerHTML = subname11;
let suburl11 = video_config_media['subtitles'][11]['url'];
let suburl11split = suburl11.split('?')[0];
let result11 = suburl11split.replace("https://v", "https://fy.v");
document.getElementById("suburl11").innerHTML = result11;

let subname12 = video_config_media['subtitles'][12]['language'];
document.getElementById("subname12").innerHTML = subname12;
let suburl12 = video_config_media['subtitles'][12]['url'];
let suburl12split = suburl12.split('?')[0];
let result12 = suburl12split.replace("https://v", "https://fy.v");
document.getElementById("suburl12").innerHTML = result12;
});
