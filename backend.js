const net = require('net');
const udp = require('dgram');
const http = require('http');
// const util = require('./util.js');
const crypt = require('crypto');
const NodeMediaServer = require('node-media-server');
const xp = require('express');
const child_process = require('child_process');
const fs = require('fs');
const app = xp();
const ws = require('ws');

let configFile = fs.readFileSync('config.json');
let config = JSON.parse(configFile);

if(process.argv.length > 2) {
	config.host = process.argv[2];
}

const context = require('./node_modules/node-media-server/node_core_ctx');
 

const configInjest = {
  rtmp: {
	host: config.host,
    port: config.ports.rtmp,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*'
  }
};
 
var nmsInjest = new NodeMediaServer(configInjest);
nmsInjest.run();

var mediaServices = {};
var controls = [];
var connections = [];
var idsToConnections = {};

app.use(xp.static('public'));

const wss = new ws.Server({ noServer: true });

function sendMessageToMediaServer(message) {
	console.log("sending message");
	let newConnection = net.createConnection(6000,"localhost", () => {
		newConnection.write(message);
		console.log("Sent to switch:",message);
	});
	controls.forEach((s) => {
		s.send(message);
	});
}

wss.on('connection', (soc, req) => {
	
	const connection = req.url.substring(1).split("/");
	
	switch(connection[0]) {
		case "control":
			controls.push(soc);
			soc.on('message', (message) => {
				sendMessageToMediaServer(message);
				console.log('received: %s', message);
			});
			soc.on('close', function() {
				controls.splice(controls.indexOf(soc));
			});
			soc.send((connections.length) ? 'init '+connections.toString() : 'init');
			break;
		case "video":
			if(connection.length < 3) {
				soc.send("false");
			}
			var closeConnection = (socket) => {
				if(mediaServices[socket]) {
					if(mediaServices[socket].ffmpeg && !mediaServices[socket].ffmpeg.exitCode) mediaServices[socket].ffmpeg.kill('SIGINT');
					connections.splice(connections.indexOf(mediaServices[socket].connectionName));
					delete mediaServices[socket];
				}
				socket.terminate();
			}
			var initMessage = (message) => {
				try {
					// The constraints are as follows:
					// 0: copy codec
					// 1: is there an audio track
					const constraints = message.split(" ");
					soc.removeAllListeners("message");
					var codec = ["-c:v"];
					codec = codec.concat((constraints[0]=="true") ? ['copy'] : ['libx264','-preset', 'veryfast','-tune', 'zerolatency']);
					var input = ["-re","-i", "pipe:"];
					if((constraints[1]=="false")) {
						input = ['-f','lavfi','-i','anullsrc'].concat(input);
						input.push("-shortest");
					}
					var command = input.concat(codec).concat(['-c:a', 'aac', '-ar', '44100', '-f', 'flv']);
					command.push("rtmp://"+config.host+"/live/"+connection[2]);
					
					console.log(command.join(" "));
					var newChild = child_process.spawn('ffmpeg',command);
					newChild.on('close', () => {
						console.log('Connection '+connection[2]+' closed');
						closeConnection(soc);
					});
					
					newChild.stdin.on('error', (e) => {
						console.log("FFMPEG Error for "+connection[2]+"\n"+e.toString());
					});
					
					/*newChild.stderr.on('data', (e) => {
						console.log("FFMPEG Error for "+mediaServices[soc].connectionName+"\n"+e.toString());
					});*/
					soc.on("message", (msg) => {
						mediaServices[soc].ffmpeg.stdin.write(msg);
					});
					soc.on("close", () => {
						closeConnection(soc);
					});
					mediaServices[soc].ffmpeg = newChild;
					soc.send("true");
					console.log("now listening");
				} catch(e) {
					closeConnection(soc);
					console.log(e);
					soc.send("false");
				}
			};
			if(connections.indexOf(connection[2]) > -1) {
				soc.send("false");
			} else {
				soc.on("message",initMessage);
				mediaServices[soc] = {
					connectionName: connection[2],
				}
				soc.send("true");
			}
			break;
	}
});

const wsListener = app.listen(80, config.host);
wsListener.on('upgrade', (req, soc, head) => {
	wss.handleUpgrade(req,soc,head,soc => {
		wss.emit('connection', soc, req);
	});
});

context.nodeEvent.on("postPublish", (sessionId,sessionPath,publishArguments) => {
	let liveArray = sessionPath.split("/");
	liveArray.shift();
	let openSocket = context.sessions.get(sessionId);
	var broadcastFunction = sendMessageToMediaServer;
	
	if(liveArray[0] != "live") {
		// TODO: add verification and appropriate calls to media relay
	} else {
		if(connections.indexOf(liveArray[1]) < 0) {
			connections.push(liveArray[1]);
			idsToConnections[sessionId] = liveArray[1];
			broadcastFunction("add "+liveArray[1]);
		} else {
			// TODO: error, this already exists
		}
	}
});

context.nodeEvent.on("doneConnect", (sessionId,closeArguments) => {
	let openSocket = context.sessions.get(sessionId);
	var broadcastFunction = sendMessageToMediaServer;
	
	if(idsToConnections[sessionId]!=null) {
		connections.splice(idsToConnections[sessionId]);
		broadcastFunction("close "+idsToConnections[sessionId]);
		delete idsToConnections[sessionId];
	}
});

/*
This was included in the server implementation

function updateListeners(service,data) {
	mediaServices[service].busy = true;
	for(var i = 0; i < mediaServices[service].listeners.length; i++) {
		if(!mediaServices[service].listeners[i].destroyed) mediaServices[service].listeners[i].write(data);
	}
	mediaServices.busy = false;
}*/

/*
 *	This was the beginning of an RTMP server implementation
 *	
 *	Currently, I do not plan on continuing this implementation, because
 *	I would like to port lower level things to C/++ so I can manage threads,
 *	delegate tasks as I see fit, and (hopefully) make an implementation that
 *	would run better than a Node implementation
 */
var testRelay = net.createServer((socket) => {
	//console.log("pomos");
	//console.log(socket);
	var packets = 2;
	socket.on("data",(data) => {
		var buf = data;
		while(buf.length > 32) {
			console.log(buf.slice(0,32));
			buf = buf.slice(32);
		}
		console.log(buf);
		/*if(packets == 2) {
			buf = buf.slice(24);
			var stringLen = buf.readUInt16BE();
			console.log(stringLen);
			console.log(buf.slice(26,26+stringLen)+"");
		} else {
			var index = 0;
			while(index != -1) {
				index = buf.indexOf(Buffer.from([0x00,0x00,0x00,0x00]));
				if(index > -1) {
					console.log(buf.slice(0,index));
					buf = buf.slice(index+4);
				}
			}
			console.log(buf);
		}*/
		//console.log(data+"");
		//console.log(data);
		packets--;
		if(packets==0) socket.removeAllListeners("data");
		var good = true;
		/*
		var command = (data+"").split(" ");
		switch(command[0]) {
			case "que":
				
				break;
			case "get":
				if(typeof mediaServices[command[1]] !== 'undefined' && mediaServices[command[1]]) {
					mediaServices[command[1]].listeners.push(socket);
					socket.on("close",() => {
						var i = mediaServices[command[1]].listeners.indexOf(socket);
						mediaServices[command[1]].listeners.splice(i,1);
					});
				} else {
					socket.write("no");
					socket.destroy();
				}
				break;
			case "put":
				if(typeof mediaServices[command[1]] === 'undefined') {
					mediaServices[command[1]] = {
						sources: {},
						active: null,
						listeners: [],
						busy: false
					};
				}
				if(typeof mediaServices[command[1]].sources[command[2]] !== 'undefined' && mediaServices[command[1]].sources[command[2]]) {
					socket.write("no");
					socket.destroy();
				} else {
					mediaServices[command[1]].sources[command[2]] = socket;
					if(mediaServices[command[1]].active == null || mediaServices[command[1]].active.destroyed) {
						mediaServices[command[1]].active = socket;
						socket.on("data", (data) => {
							updateListeners(command[1],data);
						});
					}
				}
				break;
			case "swi":
				if(typeof mediaServices[command[1]].sources[command[2]] !== 'undefined' && mediaServices[command[1]].sources[command[2]]) {
					while(mediaServices[command[1]].busy);
					mediaServices[command[1]].active = mediaServices[command[1]].sources[command[2]];
					socket.write("ok");
					socket.destroy();
				} else {
					socket.write("no");
					socket.destroy();
				}
				break;
			default:
				socket.write("no");
				socket.destroy();
		}
		if(good && !socket.destroyed) socket.write("ok");*/
	});
});

/*



testRelay.listen(config.ports.relay,config.host, () => {
	console.log("test relay ready!");
});





const testNet = net.createServer((socket)=>{
	let newConnection = net.createConnection({port:1937, host:host}, () => {
		newConnection.on('end', () => {
			socket.end();
			newConnection.end();
		});
	});
	socket.pipe(newConnection);
	newConnection.pipe(socket);
	socket.on('end', () => {
		newConnection.end();
		socket.end();
	});
}).listen(1935,host,() => {
	console.log("test relay");
});*/

//app.get(/.*/,(req,res) => {
/*	console.log(req);
	res.send("shhhhhh");
});*/

/*app.listen(80,host, () => {
	console.log("listenting on port 80");
});*/

/*
var httpTest = http.createServer(
	function(req,res) {
		console.log(req);
	}
).listen(8081,host);

var sockets = new Map();
var server = net.Server(function(socket) {
	//console.log(socket);
	socket.on("data", function(d) {
		console.log(d);
		if(sockets.get(socket)==null) {
			sockets.set(socket, newSocket(socket,d));
		} else {
			sockets.get(socket).response(d);
		}
		if(sockets.get(socket).state == -1) {
			socket.destroy();
		}
		//console.log(d);
	});
});


// This follows the RTMP protocol
function newSocket(s, d) {
	this.socket = s;
	this.version = d.readInt8(0);
	this.state = 0;
	this.clientCurrent = 0;
	this.firstShake = function(d,off) {
		this.timestart = Date.now();
		this.clientStart = d.readUInt32BE(off);
		this.clientCurrent = this.clientStart;
		if(d.readUInt32BE(off+4)!=0) {
			this.state = -1;
		} else {
			this.givenRandom = d.slice(8+off);
			crypt.randomBytes(1528, (err,r) => {
				if(err) {
					this.state = -1;
					console.log(err);
				} else {
					this.serverRandom = r;
					var temp = Buffer.alloc(9);
					// Writes version 3
					temp.writeIntBE(3,0,1);
					// Writes 4 empty bytes
					temp.writeUInt32BE(0,1);
					// Writes current timestamp (0)
					temp.writeUInt32BE(0,5);
					var s1 = Buffer.concat([temp,this.serverRandom],1537);
					this.socket.write(s1);
				}
			});
		}
	}
	this.secondShake = function(d) {
		if(d.readUInt32BE(0)!=0) {
			this.state = -1;
			return;
		}
		this.clientCurrent = d.readUInt32BE(0);
		console.log(Buffer.compare(d.slice(8),this.serverRandom));
		if(Buffer.compare(d.slice(8),this.serverRandom)!=0) {
			this.state = -1;
			return;
		}
		var temp = Buffer.alloc(8);
		temp.writeUInt32BE(this.clientStart,0);
		temp.writeUInt32BE(Date.now()-this.timestart,4);
		var s2 = Buffer.concat([temp,this.givenRandom],1536);
		this.socket.write(s2);
		console.log("finished 2");
		// TODO: Add Chunk Streaming
	}
	if(d.length==1) {
		this.state = 0;
		this.response = function(d) {
			this.firstShake(d,0);
		}
	} else if(d.length!=1537) {
		this.state = -1;
	} else {
		this.firstShake(d,1);
	}
	if(this.state > -1) {
		this.response = function(d) {
			this.secondShake(d);
		}
	}
	return this;
	//if(d.length
}

server.listen({host:host,port:8080}); */