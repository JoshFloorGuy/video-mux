let connectionContainer;
let socketConnection;
let mediaConnections;
let initialized = false;
let videoElement;
let selects;
let connectingState = 0;
let mediaRecording;

function init() {
	if(initialized) return false;
	
	videoElement = document.querySelector("#playback");
	
	selects = { 
		video: document.querySelector("#videoInput"),
		audio: document.querySelector("#audioInput"),
		resolution: document.querySelector("#videoResolution"),
		streamName: document.querySelector("#contentName")
	};
	
	navigator.mediaDevices.getUserMedia({audio: false, video: {
		width: {exact: 1280},
		height: {exact: 720}
	}}).then((stream) => {
		stream.getVideoTracks()[0].applyConstraints({
			width: {exact: 1280},
			height: {exact: 720}
		});
		return stream;
	}).then(devicesReady);; 
	
	try {
		// mediaConnections = navigator.mediaDevices.getUserMedia();
	} catch(e) {
		window.alert("Error: "+e);
	}
	
	selects.video.onchange = refreshStream;
	selects.audio.onchange = refreshStream;
	selects.resolution.onchange = refreshStream;
	
	selects.streamName.oninput = encodeInput;
	
	document.querySelector("#startStream").onclick = startStream;
	
	initialized = true;
	return true;
}

function startVideo(stream) {
	window.stream = stream;
	videoElement.srcObject = stream;
}

function refreshStream() {
	if(window.stream) {
		window.stream.getTracks().forEach((track) => {
			track.stop();
		});
	}
	const audioSource = selects.audio.value;
	const videoSource = selects.video.value;
	const aspectRatio = selects.resolution.value.split(",");
	const videoConstraints = {
		deviceId: videoSource ? {exact: videoSource} : undefined,
		width: {exact: aspectRatio[0]},
		height: {exact: aspectRatio[1]}
	}
	const constraints = {
		audio: audioSource ? {deviceId: audioSource} : false,
		video: videoConstraints
	}
	navigator.mediaDevices.getUserMedia(constraints).then(startVideo);
}

function devicesReady(stream) {
	if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
	  console.log("enumerateDevices() not supported.");
	  return false;
	}
	
	startVideo(stream);
	
	navigator.mediaDevices.enumerateDevices().then((devices) => {
		devices.forEach((device) => {
			var option = document.createElement("option");
			option.value = device.deviceId;
			switch(device.kind) {
				case 'videoinput':
					option.text = device.label || "Video input "+(selects.video.length+1);
					selects.video.appendChild(option);
					break;
				case 'audioinput':
					option.text = device.label || "Audio input "+(selects.audio.length);
					selects.audio.appendChild(option);
					break;
			}
		});
	});
}

function encodeInput(element) {
	const uriRegex = /\%../ig;
	element.target.value = encodeURIComponent(element.target.value).replaceAll(uriRegex,'-');
}

function startStream() {
	const codec = "video/webm;codecs=h264";
	const copy = MediaRecorder.isTypeSupported(codec);
	
	var options = {
		bitsPerSecond: 2000000
	}
	
	if(copy) options.mimeType = codec;
	
	selects.video.disabled = true;
	selects.audio.disabled = true;
	selects.resolution.disabled = true;
	selects.streamName.disabled = true;
	
	if(!window.stream || window.stream.getVideoTracks().length == 0) {
		window.alert("Error: Stream is invalid");
		return;
	}
	
	if(selects.streamName.value.length == 0) {
		window.alert("Error: Stream name must not be blank");
		return;
	}
	
	try {
		mediaRecording = new MediaRecorder(window.stream, options);
		
		socketConnection = new WebSocket(window.location.protocol.replace("http","ws")+"//"+window.location.hostname+"/video/live/"+selects.streamName.value);
		
		socketConnection.onclose = function() {
			window.alert("Connection with Server closed");
			if(mediaRecording && mediaRecording.state == "recording") {
				mediaRecording.stop();
				mediaRecording.reset();
				mediaRecording.release();
			};
			socketConnection = null;
	
			selects.video.disabled = false;
			selects.audio.disabled = false;
			selects.resolution.disabled = false;
			selects.streamName.disabled = false;
		}
		
		socketConnection.onmessage = function(message) {
			switch(connectingState) {
				case 0:
					if(message == "false") {
						window.alert("Error: A video with name '"+selects.streamName.value+"' already exists");
						socketConnection.close();
						socketConnection = null;
						return;
					}
					connectingState++;
					const constraints = [
						copy,
						(window.stream.getAudioTracks().length > 0)
					];
					socketConnection.send(constraints.join(" "));
					break;
				case 1:
					if(message == "false") {
						window.alert("Error: An error occured on the server side when setting up video");
						connectingState = 0;
						socketConnection.close();
						socketConnection = null;
						return;
					}
					connectingState++;
					mediaRecording.ondataavailable = (e) => {
						if(socketConnection && socketConnection.readyState == socketConnection.OPEN) socketConnection.send(e.data);
					}
					mediaRecording.start(1000);
					break;
			}
		}
	} catch(e) {
		window.alert(e);
	}
}

window.addEventListener("load", () => {
	init();
});