const net = require('net');
const http = require('http');
// const util = require('./util.js');
const crypt = require('crypto');

var httpTest = http.createServer(
	function(req,res) {
		console.log(req);
	}
).listen(8081,"localhost");

var sockets = new Map();
var server = net.Server(function(socket) {
	//console.log(socket);
	socket.on("data", function(d) {
		console.log("e");
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
	this.version = d.readInt8(0);
	this.state = 0;
	this.firstShake = function(d,off) {
		this.timestart = Date.now();
		this.clientStart = d.readUInt32BE(off);
		if(d.readUInt32BE(off+4)!=0) {
			this.state = -1;
		} else {
			
		}
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
	return this;
	//if(d.length
}

server.listen({host:"localhost",port:8080});