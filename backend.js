const net = require('net');
const http = require('http');
// const util = require('./util.js');
const crypt = require('crypto');
const NodeMediaServer = require('node-media-server');
const nps = require('node-tcp-proxy');
const xp = require('express');
const fs = require('fs');
const app = xp();

let configFile = fs.readFileSync('config.json');
let config = JSON.parse(configFile);

const context = require('./node_modules/node-media-server/node_core_ctx');

// THUMBNAILS: ffmpeg -re -i rtmp://localhost/live/a -r 1/3 -c:v libx264 -preset veryfast -tune zerolatency -vf scale=480:-1 -an -f flv rtmp://localhost/live/b
 

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

const configOutjest = {
  rtmp: {
	host: config.host,
    port: 1936,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8001,
    allow_origin: '*'
  }
};
 
var nmsInjest = new NodeMediaServer(configInjest);
nmsInjest.run();
/*var nmsOutjest = new NodeMediaServer(configOutjest);
nmsOutjest.run();*/

/*
var newProxy = nps.createProxy(1935,host,1937, {
	upstream: function(context, data) {
		//console.log(context);
        //data = replace(data, `${PROXY_HOST}:${PROXY_PORT}`, SERVICE_HOST);
        return data;
    },
    downstream: function(context, data) {
		//console.log(context);
        //data = replace(data, SERVICE_HOST, `${PROXY_HOST}:${PROXY_PORT}`);
        return data;
    }
});*/

context.nodeEvent.on("postPublish", (sessionId,sessionPath,publishArguments) => {
	let liveArray = sessionPath.split("/");
	liveArray.shift();
	let openSocket = context.sessions.get(sessionId);
	console.log(liveArray);
	//console.log(a,b,c);
	//console.log(context.sessions.get(a));
});

/*
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