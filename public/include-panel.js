let connectionContainer;
let socketConnection;
let initialized = false;

function addStream(name) {
	let newStreamElement = document.createElement("div");
	newStreamElement.classList.add("stream-container");
	newStreamElement.id = "element-"+name;
	
	let switchButton = document.createElement("button");
	switchButton.onclick = function() {
		socketConnection.send("switch "+name);
	}
	switchButton.innerHTML = "Switch to "+name;
	switchButton.id = "button-"+name;
	newStreamElement.appendChild(switchButton);
	
	//newStreamElement.appendChild(document.createTextNode("Hello, this is "+name));
	connectionContainer.appendChild(newStreamElement);
}

function init(container) {
	if(initialized) return false;
	
	connectionContainer = container;
	socketConnection = new WebSocket(window.location.protocol.replace("http","ws")+"//"+window.location.hostname+"/control");
	socketConnection.onmessage = function(message) {
		let command = message.data.split(" ");
		switch(command[0]) {
			case "init":
				if(command.length == 1) break;
				// Initializes page with a comma delimited list of already existing connections
				(command[1].split(",")).forEach((name) => {
					addStream(name);
				});
				break;
			case "add":
				// adds a single connection
				addStream(command[1]);
				break;
			case "switch":
				// switches connection
				
				break;
			case "close":
				// switches connection
				let removed = document.querySelector("#element-"+command[1]);
				if(removed) removed.parentNode.removeChild(removed);
				break;
		}
	}
	
	
	
	initialized = true;
	return true;
}

window.addEventListener("load", () => {
	init(document.body.querySelector(".main-container"));
});

